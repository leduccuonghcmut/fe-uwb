# gmc_kalman.py
# ======================================================================
# Generalized Maximum Correntropy Kalman Filter (GMC-KF)
# Implements a 4D Kalman filter (X, Y, Vx, Vy) and Interacting 
# Multiple Model (IMM) to smooth coordinates and reject outliers.
# ======================================================================

import numpy as np
import math

# Tuning Parameters
JITTER_DEADBAND = 0.20   # Deadband in meters to prevent minor coordinate jitter
STILL_VEL_CLAMP = 0.05   # Velocity below this is clamped to zero (ZUPT)
MIN_WEIGHT = 1e-8
MIN_LIKELIHOOD = 1e-6

class GMC_Kalman4D:
    """4D Kalman Filter (State: X, Y, Vx, Vy) with GMC outlier rejection."""
    def __init__(self, q, r, alpha, beta):
        self.q = q
        self.r = r
        self.alpha = alpha
        self.beta = beta
        self.x = np.zeros(4)
        self.P = np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 0.5, 0.0],
            [0.0, 0.0, 0.0, 0.5]
        ])

    def reset(self, x_val, y_val):
        self.x = np.array([x_val, y_val, 0.0, 0.0], dtype=float)
        self.P = np.array([
            [0.5, 0.0, 0.0, 0.0],
            [0.0, 0.5, 0.0, 0.0],
            [0.0, 0.0, 0.4, 0.0],
            [0.0, 0.0, 0.0, 0.4]
        ])

    def predict(self, dt):
        if dt <= 0:
            return

        # State transition
        self.x[0] += self.x[2] * dt
        self.x[1] += self.x[3] * dt

        # Process noise covariance integration
        q = self.q
        dt2 = dt * dt

        self.P[0, 0] += dt2 * self.P[2, 2] + 0.05 * q
        self.P[1, 1] += dt2 * self.P[3, 3] + 0.05 * q
        self.P[2, 2] += q * dt
        self.P[3, 3] += q * dt

        self.P[0, 2] = self.P[2, 0] = 0.98 * self.P[0, 2]
        self.P[1, 3] = self.P[3, 1] = 0.98 * self.P[1, 3]

    def update(self, z):
        # Innovation/Measurement residual
        dx = z[0] - self.x[0]
        dy = z[1] - self.x[1]
        e = math.sqrt(dx*dx + dy*dy)

        # Correntropy measurement weight estimation
        norm = e / (self.beta + 1e-9)
        w = math.exp(-math.pow(norm, self.alpha))
        w = max(w, MIN_WEIGHT)

        # Effective measurement noise variance adjusted by weight
        r_eff = self.r / (w + 1e-6)

        Kx = self.P[0, 0] / (self.P[0, 0] + r_eff)
        Ky = self.P[1, 1] / (self.P[1, 1] + r_eff)

        # Zero Velocity Update (ZUPT) and Jitter Lock
        v = math.sqrt(self.x[2]*self.x[2] + self.x[3]*self.x[3])
        if e < JITTER_DEADBAND and v < STILL_VEL_CLAMP:
            # Lock position to prevent standing jitter
            Kx = 0.0 
            Ky = 0.0
            # Kill remaining velocity
            self.x[2] = 0.0
            self.x[3] = 0.0

        x_old = self.x[0]
        y_old = self.x[1]

        # Update state and covariance
        self.x[0] += Kx * dx
        self.x[1] += Ky * dy

        self.P[0, 0] *= (1.0 - Kx)
        self.P[1, 1] *= (1.0 - Ky)

        vx = self.x[0] - x_old
        vy = self.x[1] - y_old

        a = 0.9 if w < 0.3 else 0.75

        # Update velocity components if not locked by ZUPT
        if Kx > 0.0:
            self.x[2] = a * self.x[2] + (1 - a) * vx
            self.x[3] = a * self.x[3] + (1 - a) * vy

            if abs(self.x[2]) < STILL_VEL_CLAMP: 
                self.x[2] = 0.0
            if abs(self.x[3]) < STILL_VEL_CLAMP: 
                self.x[3] = 0.0

        return np.array([self.x[0], self.x[1]])

class IMM_GMC_Kalman:
    """Interacting Multiple Model (IMM) combining multiple GMC-KF filters."""
    def __init__(self, q, r, alpha, beta):
        self.q = q
        self.r = r
        self.alpha = alpha
        self.beta = beta

        # Model 0: Low speed / standing still (q * 0.01)
        # Model 1: High speed / moving (q * 2.0)
        self.models = [
            GMC_Kalman4D(q * 0.01, r, alpha, beta * 0.8), 
            GMC_Kalman4D(q * 2.0, r, alpha, beta * 1.5)  
        ]

        self.mode_prob = np.array([0.9, 0.1])
        self.mode_trans = np.array([
            [0.99, 0.01], 
            [0.10, 0.90]  
        ])

    def reset(self, x_val, y_val):
        for model in self.models:
            model.reset(x_val, y_val)
        self.mode_prob = np.array([0.9, 0.1])

    def predict(self, dt):
        for model in self.models:
            model.predict(dt)

    def update(self, z):
        est = np.zeros((2, 2))
        lk = np.zeros(2)
        sum_lk = 0.0

        # Calculate likelihoods and update models
        for i in range(2):
            dx = z[0] - self.models[i].x[0]
            dy = z[1] - self.models[i].x[1]
            e = math.sqrt(dx*dx + dy*dy)

            w = math.exp(-math.pow(e / (self.models[i].beta + 1e-9), self.models[i].alpha))
            lk[i] = w + MIN_LIKELIHOOD
            sum_lk += lk[i]
            est[i] = self.models[i].update(z)

        lk[0] /= sum_lk
        lk[1] /= sum_lk

        # Calculate posterior mode probabilities
        p0 = self.mode_prob[0] * lk[0]
        p1 = self.mode_prob[1] * lk[1]

        s = p0 + p1 + 1e-12

        self.mode_prob[0] = p0 / s
        self.mode_prob[1] = p1 / s

        # Fuse states
        fused_x = self.mode_prob[0] * est[0][0] + self.mode_prob[1] * est[1][0]
        fused_y = self.mode_prob[0] * est[0][1] + self.mode_prob[1] * est[1][1]

        return np.array([fused_x, fused_y])