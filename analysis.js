document.addEventListener('DOMContentLoaded', function () {
    const backBtn = document.getElementById('backToSolverBtn');
    const comparisonTableBody = document.querySelector('#comparison-table tbody');

    // 请求比较数据
    fetch('/api/comparison_data')
        .then(response => {
            if (!response.ok) {
                throw new Error(`网络响应错误: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // 渲染比较表格
            renderComparisonTable(data);
        })
        .catch(error => {
            console.error('加载比较数据失败:', error);
            const loadingRow = document.getElementById('loading-row');
            if (loadingRow) {
                loadingRow.innerHTML = `<td colspan="3" style="text-align: center; color: red;">加载数据失败: ${error.message}</td>`;
            }
        });

    // 返回求解页面
    backBtn.addEventListener('click', () => {
        window.location.href = '/solver';
    });

    // 渲染结果比较表格的函数
    function renderComparisonTable(data) {
        comparisonTableBody.innerHTML = ''; // 清空旧数据（包括加载提示）
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.indicator}</td>
                <td>${row.single_base}</td>
                <td>${row.multi_base}</td>
            `;
            comparisonTableBody.appendChild(tr);
        });
    }
});