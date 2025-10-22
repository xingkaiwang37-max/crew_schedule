from flask import Flask, render_template, jsonify, send_from_directory, request
import pandas as pd
import os
import time
import random

# 初始化 Flask 应用
app = Flask(__name__, template_folder='.')

# --- API 接口 ---

# API 接口：读取 flight.csv
@app.route('/api/flights')
def get_flights():
    try:
        # 假设所有数据文件都在 static/data/ 目录下
        df = pd.read_csv('static/data/flight.csv')
        records = df.to_dict(orient='records')
        return jsonify(records)
    except FileNotFoundError:
        return jsonify({"error": "flight.csv not found in static/data/"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# API 接口：分析 crew.csv
@app.route('/api/crew_analysis')
def get_crew_analysis():
    try:
        df = pd.read_csv('static/data/crew.csv')
        base_counts = df.groupby('base').size().reset_index(name='count')
        analysis_result = base_counts.to_dict(orient='records')
        return jsonify(analysis_result)
    except FileNotFoundError:
        return jsonify({"error": "crew.csv not found in static/data/"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# API 接口：分析 groundDuty.csv
@app.route('/api/ground_duty_analysis')
def get_ground_duty_analysis():
    try:
        df = pd.read_csv('static/data/groundDuty.csv')
        duty_counts = df['isDuty'].value_counts().reset_index()
        duty_counts.columns = ['status', 'count']
        status_map = {1: '执勤', 0: '休息/占位'}
        duty_counts['name'] = duty_counts['status'].map(status_map)
        analysis_result = [{'name': row['name'], 'value': row['count']} for index, row in duty_counts.iterrows()]
        return jsonify(analysis_result)
    except FileNotFoundError:
        return jsonify({"error": "groundDuty.csv not found in static/data/"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# API 接口：模拟求解
@app.route('/api/solve', methods=['POST'])
def solve_scheduling():
    data = request.json
    mode = data.get('mode')
    start_date = data.get('startDate')
    end_date = data.get('endDate')
    print(f"收到求解请求：模式={mode}, 开始日期={start_date}, 结束日期={end_date}")
    time.sleep(3)
    if mode == 'multi-base':
        gantt_data_file = 'multi_base_gantt_chart_data.json'
    else:
        gantt_data_file = 'single_base_gantt_chart_data.json'
    return jsonify({
        "message": "求解成功！",
        "gantt_data_url": f"/static/data/{gantt_data_file}"
    })

# API 接口：提供结果比较数据
@app.route('/api/comparison_data')
def get_comparison_data():
    comparison_data = [
        {"indicator": "日均执勤飞时", "single_base": "4.19 h", "multi_base": "5.01 h"},
        {"indicator": "航班覆盖率", "single_base": "70.69%", "multi_base": "95.17%"},
        {"indicator": "外站过夜天数", "single_base": "1331", "multi_base": "1391"},
        {"indicator": "新增过夜机场数量", "single_base": "2", "multi_base": "2"},
        {"indicator": "置位次数", "single_base": "1284", "multi_base": "1320"}
    ]
    return jsonify(comparison_data)

# --- 页面路由 ---

# 根路由，显示主页
@app.route('/')
def index():
    return render_template('page1.html')

# 求解页面路由
@app.route('/solver')
def solver_page():
    return render_template('solver.html')

# 【新增】分析页面路由
@app.route('/analysis')
def analysis_page():
    return render_template('analysis.html')

# 通用静态文件路由 (必须放在所有具体页面路由之后)
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

# --- 运行应用 ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)