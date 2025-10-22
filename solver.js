document.addEventListener('DOMContentLoaded', function () {
    // DOM 元素获取
    const dateRangePicker = flatpickr("#date-range", { mode: "range", dateFormat: "Y-m-d", locale: { rangeSeparator: ' 至 ' } });
    const startSolveBtn = document.getElementById('start-solve-btn');
    const backBtn = document.getElementById('backToDataLoad');
    const resultSection = document.getElementById('result-section');
    const loadingSpinner = document.getElementById('loading-spinner');
    const ganttContainer = document.getElementById('gantt-container');
    const resultTitle = document.getElementById('result-title');
    const ganttControls = document.getElementById('gantt-controls');
    const analyzeResultBtn = document.getElementById('analyze-result-btn');

    // 返回按钮
    backBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

    // 分析结果按钮
    analyzeResultBtn.addEventListener('click', () => {
        alert('跳转到排班结果分析页面...');
        // window.location.href = 'analysis.html';
    });

    /**
     * 使用 Highcharts 创建甘特图的函数
     * @param {object} data - 从后端获取的图表数据
     */
    function createGanttChart(data) {
        // --- 动态高度和宽度计算 ---
        const rowHeight = 40; // 每个任务行的高度
        const numCategories = data.yAxisCategories.length;
        // 计算绘图区需要完整显示所有任务的最小高度
        const totalPlotHeight = numCategories * rowHeight;

        // 设置图表容器的可见高度，如果内容超出此高度，将出现滚动条
        // *** 这是您要调整的参数 ***
        const visibleChartHeight = 100; // 您可以修改这个值，例如 400 或 800
        ganttContainer.style.height = visibleChartHeight + 'px';

        let minDate = Infinity;
        let maxDate = -Infinity;
        data.seriesData.forEach(task => {
            if (task.start < minDate) minDate = task.start;
            if (task.end > maxDate) maxDate = task.end;
        });
        const day = 1000 * 60 * 60 * 24;
        const durationDays = Math.ceil((maxDate - minDate) / day);
        const pixelsPerDay = 1000;
        const newPlotWidth = durationDays * pixelsPerDay;

        // --- 设置初始显示范围的时间戳 ---
        const initialStartDate = Date.UTC(2025, 4, 29); // 2025年5月29日
        const initialVisibleDays = 30;
        const initialEndDate = initialStartDate + initialVisibleDays * day;

        // --- 初始化图表 ---
        Highcharts.ganttChart('gantt-container', {
            title: {
                text: '机组排班结果甘特图'
            },
            chart: {
                scrollablePlotArea: {
                    minWidth: newPlotWidth,
                    minHeight: totalPlotHeight // 设置绘图区的最小内容高度
                },
                events: {
                    load: function () {
                        this.xAxis[0].setExtremes(initialStartDate, initialEndDate);
                    }
                }
            },
            xAxis: {
                scrollbar: {
                    enabled: true
                }
            },
            yAxis: {
                uniqueNames: true,
                categories: data.yAxisCategories,
                scrollbar: {
                    enabled: true // 为 Y 轴启用滚动条
                }
            },
            series: [{
                name: '排班任务',
                data: data.seriesData
            }],
            tooltip: {
                pointFormat: '<span>航班号: {point.flightNumber}</span><br/>' +
                             '<span>机组: {point.yCategory}</span><br/>' +
                             '<span>开始: {point.start:%Y-%m-%d %H:%M}</span><br/>' +
                             '<span>结束: {point.end:%Y-%m-%d %H:%M}</span>'
            }
        });
    }

    // “开始求解”按钮点击事件
    startSolveBtn.addEventListener('click', () => {
        // UI准备
        resultSection.style.display = 'block';
        loadingSpinner.style.display = 'flex';
        ganttContainer.style.display = 'none';
        ganttContainer.innerHTML = ''; // 清空旧图表
        ganttControls.style.display = 'none';
        analyzeResultBtn.style.display = 'none';

        // 确定要加载的数据文件
        const solveMode = document.querySelector('input[name="solver-mode"]:checked').value;
        const dataPath = solveMode === 'single-base'
            ? 'static/data/single_base_gantt_chart_data.json'
            : 'static/data/multi_base_gantt_chart_data.json';

        // 模拟求解延迟后加载数据并生成图表
        setTimeout(() => {
            fetch(dataPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('网络响应错误或文件未找到');
                    }
                    return response.json();
                })
                .then(data => {
                    // 数据加载成功，生成甘特图
                    loadingSpinner.style.display = 'none';
                    ganttContainer.style.display = 'block';
                    createGanttChart(data); // 调用函数创建图表
                    
                    analyzeResultBtn.style.display = 'inline-block';
                })
                .catch(error => {
                    console.error('加载甘特图数据失败:', error);
                    loadingSpinner.style.display = 'none';
                    ganttContainer.innerHTML = `<p style="color: red;">加载结果数据失败: ${error.message}。请确保文件路径 ${dataPath} 正确。</p>`;
                    ganttContainer.style.display = 'block';
                });
        }, 2000); // 模拟2秒求解时间
    });
});