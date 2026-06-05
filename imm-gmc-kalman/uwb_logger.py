# uwb_logger.py
# ======================================================================
# UWB Evaluation & Statistics Logger
# ======================================================================

import time
import csv
import os
import math

TEMP_FILE = 'vitri.txt'
DEFAULT_CSV = 'uwb_evaluation_log.csv'

def calculate_stats(samples, true_pos=None):
    """Calculates positioning precision and accuracy metrics."""
    n = len(samples)
    if n == 0:
        return None
        
    sum_x = sum(s['x'] for s in samples)
    sum_y = sum(s['y'] for s in samples)
    mean_x = sum_x / n
    mean_y = sum_y / n
    
    # Calculate variance and standard deviation (Precision)
    var_x = sum((s['x'] - mean_x) ** 2 for s in samples) / n
    var_y = sum((s['y'] - mean_y) ** 2 for s in samples) / n
    std_x = math.sqrt(var_x)
    std_y = math.sqrt(var_y)
    
    stats = {
        'n': n,
        'mean_x': mean_x,
        'mean_y': mean_y,
        'std_x': std_x,
        'std_y': std_y,
    }
    
    # Calculate accuracy metrics if ground truth coordinates are provided
    if true_pos:
        tx, ty = true_pos
        errors = []
        for s in samples:
            err = math.sqrt((s['x'] - tx)**2 + (s['y'] - ty)**2)
            errors.append(err)
            s['error'] = err
            
        mean_err = sum(errors) / n
        max_err = max(errors)
        min_err = min(errors)
        rmse = math.sqrt(sum(e**2 for e in errors) / n)
        
        # Circular Error Probable (CEP) calculations
        sorted_errors = sorted(errors)
        cep90 = sorted_errors[int(0.9 * n)] if n > 0 else 0.0
        cep50 = sorted_errors[int(0.5 * n)] if n > 0 else 0.0
        
        stats.update({
            'mean_error': mean_err,
            'max_error': max_err,
            'min_error': min_err,
            'rmse': rmse,
            'cep50': cep50,
            'cep90': cep90
        })
        
    return stats

def main():
    print("=========================================================")
    print("  UWB POSITION LOGGER & EVALUATION TOOL")
    print("=========================================================")
    
    # Check if position stream input file exists
    if not os.path.exists(TEMP_FILE):
        print(f"[WARN] Temporary file {TEMP_FILE} not found. Creating a blank placeholder.")
        with open(TEMP_FILE, "w") as f:
            f.write("-1,0.0,0.0")

    csv_filename = input(f"Enter output CSV filename (Default: {DEFAULT_CSV}): ").strip()
    if not csv_filename:
        csv_filename = DEFAULT_CSV
    if not csv_filename.endswith('.csv'):
        csv_filename += '.csv'

    file_exists = os.path.exists(csv_filename)
    with open(csv_filename, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['Timestamp', 'Session_Point', 'True_X', 'True_Y', 'Est_X', 'Est_Y', 'Err_Distance'])

    while True:
        try:
            print("\n---------------------------------------------------------")
            print("Configure New Logging Session (Press Ctrl+C to Exit)")
            print("---------------------------------------------------------")
            
            point_name = input("Enter test point identifier (e.g. P1, Point_A): ").strip()
            if not point_name:
                point_name = "Unnamed_Point"
                
            true_coords_str = input("Enter true coordinates X, Y in meters (e.g. 2.5 3.8, blank to skip error eval): ").strip()
            true_pos = None
            if true_coords_str:
                try:
                    parts = true_coords_str.replace(',', ' ').split()
                    true_pos = (float(parts[0]), float(parts[1]))
                    print(f"[CONFIG] Ground Truth parsed: X={true_pos[0]}m, Y={true_pos[1]}m")
                except Exception:
                    print("[WARN] Invalid coordinate format. Skipping distance error evaluation.")
                    true_pos = None

            num_samples_str = input("Enter number of samples to collect (Default: 30): ").strip()
            num_samples = 30
            if num_samples_str.isdigit():
                num_samples = int(num_samples_str)

            input(f"Ready to collect {num_samples} samples. Press [ENTER] to start...")
            print("Collecting coordinates from real-time log stream...")
            
            samples = []
            last_seq = "-1"
            start_time = time.time()
            
            while len(samples) < num_samples:
                try:
                    with open(TEMP_FILE, "r") as f:
                        current_data = f.read().strip()
                        
                    if current_data != "":
                        parts = current_data.split(',')
                        if len(parts) == 3:
                            seq, x_val, y_val = parts[0], float(parts[1]), float(parts[2])
                            
                            if seq != last_seq:
                                timestamp_str = time.strftime('%Y-%m-%d %H:%M:%S')
                                sample_item = {'x': x_val, 'y': y_val, 'seq': seq}
                                samples.append(sample_item)
                                last_seq = seq
                                
                                progress = int((len(samples) / num_samples) * 100)
                                print(f"   -> [{len(samples)}/{num_samples}] ({progress}%) | Seq {seq} | X={x_val:5.2f}m, Y={y_val:5.2f}m", end='\r')
                except Exception:
                    pass
                
                time.sleep(0.01)
            
            duration = time.time() - start_time
            print(f"\n[OK] Successfully collected {num_samples} samples in {duration:.2f} seconds.")

            stats = calculate_stats(samples, true_pos)
            
            with open(csv_filename, mode='a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                for s in samples:
                    tx = true_pos[0] if true_pos else ""
                    ty = true_pos[1] if true_pos else ""
                    err_dist = s.get('error', "")
                    writer.writerow([
                        time.strftime('%Y-%m-%d %H:%M:%S'),
                        point_name,
                        tx,
                        ty,
                        s['x'],
                        s['y'],
                        f"{err_dist:.3f}" if isinstance(err_dist, float) else ""
                    ])
                    
            print("\n=========================================================")
            print(f" STATISTICAL REPORT - TEST POINT: {point_name}")
            print("=========================================================")
            print(f"- Collected Samples       : {stats['n']}")
            print(f"- Estimated Mean Position : X_mean = {stats['mean_x']:.3f}m, Y_mean = {stats['mean_y']:.3f}m")
            print(f"- Precision (StdDev)      : Std_X = {stats['std_x']:.4f}m, Std_Y = {stats['std_y']:.4f}m")
            
            if true_pos:
                print(f"- Ground Truth Position   : X_true = {true_pos[0]}m, Y_true = {true_pos[1]}m")
                print(f"- Mean Distance Error     : {stats['mean_error']*100:.2f} cm")
                print(f"- Max Distance Error      : {stats['max_error']*100:.2f} cm")
                print(f"- Min Distance Error      : {stats['min_error']*100:.2f} cm")
                print(f"- RMSE                    : {stats['rmse']*100:.2f} cm")
                print(f"- CEP50 Radius            : {stats['cep50']*100:.2f} cm")
                print(f"- CEP90 Radius            : {stats['cep90']*100:.2f} cm")
            print("=========================================================")
            print(f"Saved raw data log to: {csv_filename}")
            
        except KeyboardInterrupt:
            print("\n[INFO] Logger program terminated.")
            break

if __name__ == "__main__":
    main()
