document.addEventListener('DOMContentLoaded', function() {
    // 【核心修正】修改 dateFormat 以匹配 CSV 中的 'YYYY/M/D' 格式
    flatpickr("#scheduleDate", {
        dateFormat: "Y/n/j",      // 输出格式: 2025/5/31 (无前导零)
        defaultDate: "2025/5/29"  // 设置一个 CSV 中存在的默认日期
    });

    // 获取所有需要的 DOM 元素
    const loadDataBtn = document.getElementById('loadDataBtn');
    const backToHomeBtn = document.getElementById('backToHome');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const scheduleDateInput = document.getElementById('scheduleDate');
    
    const successMessage = document.getElementById('successMessage');
    const loadedDateSpan = document.getElementById('loadedDate');
    const recordCountSpan = document.getElementById('recordCount');
    
    const analysisSection = document.getElementById('analysis-section');
    const crewChartContainer = document.getElementById('crew-base-chart');
    const groundDutyChartContainer = document.getElementById('ground-duty-chart');
    
    const dataTableContainer = document.getElementById('dataTableContainer');

    let dataTable = null;
    let crewChart = null;
    let groundDutyChart = null;

    // 加载数据按钮点击事件
    loadDataBtn.addEventListener('click', function() {
        const selectedDate = scheduleDateInput.value;
        if (!selectedDate) {
            alert('请先选择一个日期！');
            return;
        }

        // 并行获取所有分析数据
        Promise.all([
            fetch('/api/flights').then(res => res.json()),
            fetch('/api/crew_analysis').then(res => res.json()),
            fetch('/api/ground_duty_analysis').then(res => res.json())
        ])
        .then(([allFlights, crewAnalysisData, groundDutyData]) => {
            // 检查并抛出错误
            if (allFlights.error) throw new Error(`航班数据: ${allFlights.error}`);
            if (crewAnalysisData.error) throw new Error(`机组分析: ${crewAnalysisData.error}`);
            if (groundDutyData.error) throw new Error(`地面任务分析: ${groundDutyData.error}`);

            // 1. 筛选并显示航班数据表格 (现在比较逻辑将正确工作)
            const filteredFlights = allFlights.filter(flight => flight.std && flight.std.split(' ')[0] === selectedDate);
            
            loadedDateSpan.textContent = selectedDate;
            recordCountSpan.textContent = filteredFlights.length;
            successMessage.style.display = 'flex';
            dataTableContainer.style.display = 'block';

            const tableData = filteredFlights.map(f => ({
                id: f.id, depaAirport: f.depaAirport, arriAirport: f.arriAirport,
                std: f.std, sta: f.sta, aircraftNo: f.aircraftNo
            }));

            if (dataTable) {
                dataTable.clear().rows.add(tableData).draw();
            } else {
                dataTable = $('#scheduleTable').DataTable({
                    data: tableData,
                    columns: [
                        { data: 'id', title: '航班ID' },
                        { data: 'depaAirport', title: '出发机场' },
                        { data: 'arriAirport', title: '到达机场' },
                        { data: 'std', title: '计划起飞时间' },
                        { data: 'sta', title: '计划抵达时间' },
                        { data: 'aircraftNo', title: '机尾号' }
                    ],
                    responsive: true,
                    language: { "url": "https://cdn.datatables.net/plug-ins/1.11.5/i18n/zh-CN.json" }
                });
            }

            // 2. 显示分析图表
            analysisSection.style.display = 'block';
            renderCrewBaseChart(crewAnalysisData);
            renderGroundDutyChart(groundDutyData);

        })
        .catch(error => {
            console.error('数据加载或处理失败:', error);
            alert(`数据加载失败: ${error.message}\n请检查后端服务和CSV文件路径。`);
        });
    });

    // 渲染机组基地分布柱状图
    function renderCrewBaseChart(data) {
        if (!crewChart) crewChart = echarts.init(crewChartContainer);
        const option = {
            title: { text: '机组人员基地分布', left: 'center' },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: data.map(item => item.base), axisLabel: { interval: 0, rotate: 30 } },
            yAxis: { type: 'value', name: '人员数量' },
            series: [{ name: '人员数量', type: 'bar', data: data.map(item => item.count), barWidth: '60%', itemStyle: { color: '#3f51b5' } }]
        };
        crewChart.setOption(option);
    }

    // 渲染地面任务分布饼图
    function renderGroundDutyChart(data) {
        if (!groundDutyChart) groundDutyChart = echarts.init(groundDutyChartContainer);
        const option = {
            title: { text: '地面任务执勤/休息分布', left: 'center' },
            tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c} ({d}%)' },
            legend: { top: 'bottom' },
            series: [{
                name: '任务状态', type: 'pie', radius: '55%', center: ['50%', '50%'],
                data: data,
                emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
            }]
        };
        groundDutyChart.setOption(option);
    }

    // 按钮跳转事件
    if (nextStepBtn) {
        // 【修改】将跳转链接从 /solver 改为 /index.html
        nextStepBtn.addEventListener('click', () => { window.location.href = '/index.html'; });
    }
    backToHomeBtn.addEventListener('click', () => { window.location.href = '/'; });

    // 图表自适应窗口大小变化
    window.addEventListener('resize', function() {
        if (crewChart) crewChart.resize();
        if (groundDutyChart) groundDutyChart.resize();
    });
});