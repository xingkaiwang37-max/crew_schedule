document.addEventListener('DOMContentLoaded', function() {
    // 初始化 Flatpickr 日期选择器
    flatpickr("#scheduleDate", {
        dateFormat: "Y/n/j", // 匹配 CSV 中的 YYYY/M/D 格式
    });

    // 获取所有需要的 DOM 元素
    const loadDataBtn = document.getElementById('loadDataBtn');
    const backToHomeBtn = document.getElementById('backToHome');
    const successMessage = document.getElementById('successMessage');
    const loadedDateSpan = document.getElementById('loadedDate');
    const recordCountSpan = document.getElementById('recordCount');
    const dataTableSection = document.querySelector('.data-table-section');
    const scheduleDateInput = document.getElementById('scheduleDate');
    const analysisSection = document.getElementById('analysis-section');
    const crewChartContainer = document.getElementById('crew-base-chart');
    const groundDutyChartContainer = document.getElementById('ground-duty-chart'); // 新增饼图容器
    const nextStepBtn = document.getElementById('nextStepBtn');

    let dataTable = null;
    let crewChart = null;
    let groundDutyChart = null; // 新增饼图实例变量

    // 加载数据按钮点击事件
    loadDataBtn.addEventListener('click', function() {
        const selectedDate = scheduleDateInput.value;
        if (!selectedDate) {
            alert('请先选择一个日期！');
            return;
        }

        // 使用 Promise.all 同时请求所有数据
        Promise.all([
            fetch('/api/flights').then(res => res.json()),
            fetch('/api/crew_analysis').then(res => res.json()),
            fetch('/api/ground_duty_analysis').then(res => res.json()) // 新增请求
        ])
        .then(([allFlights, crewAnalysisData, groundDutyData]) => {
            // 检查所有请求是否都成功
            if (allFlights.error) throw new Error(`航班数据: ${allFlights.error}`);
            if (crewAnalysisData.error) throw new Error(`机组分析: ${crewAnalysisData.error}`);
            if (groundDutyData.error) throw new Error(`地面任务分析: ${groundDutyData.error}`);

            // --- 1. 处理航班数据并显示表格 ---
            const filteredFlights = allFlights.filter(flight => flight.std.split(' ')[0] === selectedDate);
            loadedDateSpan.textContent = selectedDate;
            recordCountSpan.textContent = filteredFlights.length;
            successMessage.style.display = 'block';
            dataTableSection.style.display = 'block';
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
                        { data: 'id' }, { data: 'depaAirport' }, { data: 'arriAirport' },
                        { data: 'std' }, { data: 'sta' }, { data: 'aircraftNo' }
                    ],
                    responsive: true,
                    language: { "url": "https://cdn.datatables.net/plug-ins/1.11.5/i18n/zh-CN.json" }
                });
            }

            // --- 2. 显示分析区域并渲染所有图表 ---
            analysisSection.style.display = 'block';
            renderCrewBaseChart(crewAnalysisData);
            renderGroundDutyChart(groundDutyData); // 调用新的渲染函数

        })
        .catch(error => {
            console.error('数据加载或处理失败:', error);
            alert(`数据加载失败: ${error.message}\n请检查后端服务和CSV文件路径是否正确。`);
        });
    });

    /**
     * 渲染机组基地分布柱状图 (已有函数)
     */
    function renderCrewBaseChart(data) {
        if (!crewChart) {
            crewChart = echarts.init(crewChartContainer);
        }
        const bases = data.map(item => item.base);
        const counts = data.map(item => item.count);
        const option = {
            title: { text: '机组人员基地分布', left: 'center' },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: bases, axisLabel: { interval: 0, rotate: 30 } },
            yAxis: { type: 'value', name: '人员数量' },
            series: [{ name: '人员数量', type: 'bar', data: counts, barWidth: '60%', itemStyle: { color: '#5470C6' } }]
        };
        crewChart.setOption(option);
    }

    /**
     * 新增：使用 ECharts 渲染地面任务分布饼图
     * @param {Array} data - 后端返回的分析数据，格式为 [{name: '执勤', value: N}, {name: '休息/占位', value: M}]
     */
    function renderGroundDutyChart(data) {
        if (!groundDutyChart) {
            groundDutyChart = echarts.init(groundDutyChartContainer);
        }
        const option = {
            title: {
                text: '地面任务执勤/休息分布',
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b} : {c} ({d}%)' // 提示框格式
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                data: data.map(item => item.name)
            },
            series: [{
                name: '任务状态',
                type: 'pie',
                radius: '55%',
                center: ['50%', '60%'],
                data: data,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
             }]
        };
        groundDutyChart.setOption(option);
    }

    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', function() {
            window.location.href = '/solver'; // 跳转到求解页面
        });
    }

    // 返回首页按钮点击事件
    backToHomeBtn.addEventListener('click', function() {
        window.location.href = '/';
    });

    // 监听窗口大小变化，使所有图表自适应
    window.addEventListener('resize', function() {
        if (crewChart) {
            crewChart.resize();
        }
        if (groundDutyChart) {
            groundDutyChart.resize();
        }
    });
});