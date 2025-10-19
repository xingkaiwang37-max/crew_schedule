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
    const searchInput = document.getElementById('gantt-search-input');
    const searchBtn = document.getElementById('gantt-search-btn');
    const resetBtn = document.getElementById('gantt-reset-btn');
    const analyzeResultBtn = document.getElementById('analyze-result-btn'); // 获取分析按钮

    // 全局变量
    let originalGanttData = null;
    let ganttChartInstance = null;

    // 返回按钮
    backBtn.addEventListener('click', () => { window.location.href = 'load_data.html'; });

    // “开始求解”按钮
    startSolveBtn.addEventListener('click', () => {
        const selectedMode = document.querySelector('input[name="solver-mode"]:checked').value;
        const selectedDates = dateRangePicker.selectedDates;
        if (selectedDates.length < 2) {
            alert('请选择一个完整的起止日期范围！');
            return;
        }
        const [startDate, endDate] = selectedDates.map(d => d.toISOString().split('T')[0]);
        resultSection.style.display = 'block';
        loadingSpinner.style.display = 'block';
        ganttContainer.style.display = 'none';
        ganttControls.style.display = 'none';
        analyzeResultBtn.style.display = 'none'; // 求解开始时先隐藏

        fetch('/api/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: selectedMode, startDate: startDate, endDate: endDate }),
        })
        .then(response => response.json())
        .then(result => {
            if (result.error) throw new Error(result.error);
            resultTitle.textContent = `“${selectedMode === 'multi-base' ? '多基地' : '单基地'}”模式求解结果`;
            return fetch(result.gantt_data_url);
        })
        .then(response => {
            if (!response.ok) throw new Error(`加载甘特图数据失败: ${response.statusText}`);
            return response.json();
        })
        .then(ganttData => {
            loadingSpinner.style.display = 'none';
            ganttContainer.style.display = 'block';
            ganttControls.style.display = 'block';
            
            // 【关键代码】在这里显示分析按钮
            analyzeResultBtn.style.display = 'inline-block'; 
            
            originalGanttData = JSON.parse(JSON.stringify(ganttData));
            createGanttChart(originalGanttData);
        })
        .catch(error => {
            console.error('求解或加载图表失败:', error);
            loadingSpinner.style.display = 'none';
            resultTitle.textContent = '求解失败';
            ganttContainer.innerHTML = `<p style="color: red;">错误: ${error.message}。</p>`;
            ganttContainer.style.display = 'block';
        });
    });

    // 执行搜索的函数
    function performSearch() {
        if (!originalGanttData || !ganttChartInstance) return;
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            updateGanttChart(originalGanttData);
            return;
        }
        const matchedCrewIndices = new Set();
        originalGanttData.yAxisCategories.forEach((crewId, index) => {
            if (crewId.toLowerCase().includes(searchTerm)) matchedCrewIndices.add(index);
        });
        originalGanttData.seriesData.forEach(task => {
            if (task.name.toLowerCase().includes(searchTerm)) matchedCrewIndices.add(task.y);
        });
        const filteredData = { yAxisCategories: [], seriesData: [] };
        const oldIndexToNewIndexMap = new Map();
        originalGanttData.yAxisCategories.forEach((crewId, oldIndex) => {
            if (matchedCrewIndices.has(oldIndex)) {
                oldIndexToNewIndexMap.set(oldIndex, filteredData.yAxisCategories.length);
                filteredData.yAxisCategories.push(crewId);
            }
        });
        originalGanttData.seriesData.forEach(task => {
            if (matchedCrewIndices.has(task.y)) {
                const newTask = { ...task };
                newTask.y = oldIndexToNewIndexMap.get(task.y);
                filteredData.seriesData.push(newTask);
            }
        });
        updateGanttChart(filteredData);
    }

    // 搜索事件监听
    searchInput.addEventListener('input', performSearch);
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

    // 重置按钮
    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        if (originalGanttData) updateGanttChart(originalGanttData);
    });

    // 分析结果按钮点击事件
    analyzeResultBtn.addEventListener('click', () => {
        const selectedMode = document.querySelector('input[name="solver-mode"]:checked').value;
        window.location.href = `/analysis?mode=${selectedMode}`;
    });

    // 更新图表函数
    function updateGanttChart(data) {
        if (!ganttChartInstance) return;
        const processedData = data.seriesData.map(item => ({ ...item, start: new Date(item.start).getTime(), end: new Date(item.end).getTime() }));
        ganttChartInstance.update({
            yAxis: { categories: data.yAxisCategories },
            series: [{ data: processedData }]
        });
    }

    // 创建图表函数
    function createGanttChart(data) {
        const processedData = data.seriesData.map(item => ({ ...item, start: new Date(item.start).getTime(), end: new Date(item.end).getTime() }));
        ganttContainer.style.height = '700px';
        const allStarts = processedData.map(d => d.start).filter(d => !isNaN(d));
        const allEnds = processedData.map(d => d.end).filter(d => !isNaN(d));
        const xAxisMin = allStarts.length > 0 ? Math.min(...allStarts) : new Date().getTime();
        const xAxisMax = allEnds.length > 0 ? Math.max(...allEnds) : new Date().getTime();
        ganttChartInstance = Highcharts.ganttChart('gantt-container', {
            chart: { animation: false },
            title: { text: '机组排班结果甘特图' },
            yAxis: { uniqueNames: true, categories: data.yAxisCategories, max: 15, scrollbar: { enabled: true, showFull: false } },
            xAxis: [{ min: xAxisMin, max: xAxisMax, currentDateIndicator: true }],
            series: [{ name: '排班任务', data: processedData }],
            tooltip: { pointFormat: '<span><b>{point.name}</b></span><br/><span>从: {point.start:%Y-%m-%d %H:%M}</span><br/><span>到: {point.end:%Y-%m-%d %H:%M}</span>' },
            lang: { noData: "没有可显示的数据" },
            navigator: { enabled: true },
            scrollbar: { enabled: true },
            rangeSelector: { enabled: true, selected: 0 }
        });
    }
});