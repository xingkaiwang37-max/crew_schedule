document.addEventListener('DOMContentLoaded', () => {
    // 1. 数据准备
    const data = {
        goal: "机组人员排班方案选择", // 更新目标
        criteria: [
            { id: "C1", name: "总飞行时间" },
            { id: "C2", name: "工作天数" },
            { id: "C3", name: "外站过夜天数" },
            { id: "C4", name: "夜航航班次数" },
            { id: "C5", name: "经过机场数量" }
        ],
        // 假设的替代方案：三名机组人员
        alternatives: [
            { id: "P1", name: "机组A" }, // Crew A
            { id: "P2", name: "机组B" }, // Crew B
            { id: "P3", name: "机组C" }  // Crew C
        ],
        // 准则层判断矩阵 (不变)
        criteriaMatrix: [
             1.00,  3.00,  5.00,  4.00,  5.00,
             0.33,  1.00,  3.00,  2.00,  3.00,
             0.20,  0.33,  1.00,  0.33,  1.00,
             0.25,  0.50,  3.00,  1.00,  3.00,
             0.20,  0.33,  1.00,  0.33,  1.00
        ],
        // 以下是为每个准则构造的三个机组人员的方案层判断矩阵 (3x3)
        // 这些是假设数据，代表了在每个准则下，机组人员之间的相对重要性/表现
        // 例如：机组A vs 机组B: 1/2，意味着机组B在当前准则下比机组A稍微好一些
        alternativesMatrix_C1: [ // 总飞行时间最大化 (希望飞行时间长的机组优先级高)
             1,   2,   3,  // A 比 B 和 C 飞行时间长
             1/2, 1,   2,  // B 比 C 飞行时间长
             1/3, 1/2, 1
        ],
        alternativesMatrix_C2: [ // 工作天数最小化 (希望工作天数少的机组优先级高)
             1,   1/2, 1/3, // A 工作天数少于 B 和 C
             2,     1, 1/2, // B 工作天数少于 C
             3,     2, 1
        ],
        alternativesMatrix_C3: [ // 外站过夜天数最小化 (希望过夜天数少的机组优先级高)
             1,   1,   1/2, // A 和 B 差不多，都比 C 过夜天数少
             1,   1,   1/2,
             2,   2,   1
        ],
        alternativesMatrix_C4: [ // 夜航航班次数最小化 (希望夜航少的机组优先级高)
             1,   2,   1, // A 和 C 夜航次数差不多，都比 B 少
             1/2, 1,   1/2,
             1,   2,   1
        ],
        alternativesMatrix_C5: [ // 经过机场数量最小化 (希望经过机场少的机组优先级高)
             1,   1/3, 1/5, // A 经过机场数量远少于 B 和 C
             3,     1, 1/2, // B 经过机场数量少于 C
             5,     2, 1
        ],
        calculatedWeights: {} // 将在这里填充计算结果
    };

    // --- AHP 算法相关辅助函数 (与上一个回答保持一致) ---

    // 随机一致性指标 (RI) 表，根据矩阵阶数 n
    const RI_TABLE = [0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51]; // n=1,2,3...11

    /**
     * 将一维数组的判断矩阵转换为二维数组
     * @param {number[]} matrix1D 一维数组表示的矩阵
     * @param {number} n 矩阵的阶数 (n x n)
     * @returns {number[][]} 二维数组表示的矩阵
     */
    function convertTo2DMatrix(matrix1D, n) {
        const matrix2D = [];
        for (let i = 0; i < n; i++) {
            matrix2D.push(matrix1D.slice(i * n, (i + 1) * n));
        }
        return matrix2D;
    }

    /**
     * 计算矩阵的特征向量（权重）和最大特征值 (λ_max)
     * 使用特征根法（归一化几何平均法作为近似）
     * 详见AHP理论，这里使用一个常用近似方法：归一化几何平均法
     * @param {number[][]} matrix 2D判断矩阵
     * @returns {{weights: number[], lambdaMax: number}} 权重向量和最大特征值
     */
    function calculateWeightsAndLambdaMax(matrix) {
        const n = matrix.length;
        if (n === 0) return { weights: [], lambdaMax: 0 };

        const geometricMeans = [];
        for (let i = 0; i < n; i++) {
            let product = 1;
            for (let j = 0; j < n; j++) {
                product *= matrix[i][j];
            }
            geometricMeans.push(Math.pow(product, 1 / n));
        }

        const sumOfGeometricMeans = geometricMeans.reduce((sum, val) => sum + val, 0);

        const weights = geometricMeans.map(gm => gm / sumOfGeometricMeans);

        // 计算 lambda_max
        let lambdaMax = 0;
        let sumAW_over_W = 0;
        for (let i = 0; i < n; i++) {
            let rowSum = 0; // (A * w)_i
            for (let j = 0; j < n; j++) {
                rowSum += matrix[i][j] * weights[j];
            }
            // 避免除以零的错误
            if (weights[i] !== 0) {
                sumAW_over_W += rowSum / weights[i];
            } else {
                // 如果权重为0，这个方案可能权重极低，或者判断矩阵有问题
                // 这里简单地跳过，实际应用中可能需要更复杂的处理或错误提示
                console.warn(`Warning: Weight for row ${i} is zero, skipping lambdaMax contribution.`);
            }
        }
        lambdaMax = sumAW_over_W / n;

        return { weights, lambdaMax };
    }

    /**
     * 计算一致性指标 (CI)
     * @param {number} lambdaMax 最大特征值
     * @param {number} n 矩阵阶数
     * @returns {number} CI值
     */
    function calculateCI(lambdaMax, n) {
        if (n <= 1) return 0;
        return (lambdaMax - n) / (n - 1);
    }

    /**
     * 计算一致性比率 (CR)
     * @param {number} ci 一致性指标
     * @param {number} n 矩阵阶数
     * @returns {number} CR值
     */
    function calculateCR(ci, n) {
        if (n <= 1) return 0;
        const ri = RI_TABLE[n];
        if (ri === undefined || ri === 0) return NaN;
        return ci / ri;
    }

    // --- 主 AHP 计算逻辑 ---
    function performAHPCalculations() {
        const nCriteria = data.criteria.length;
        const nAlternatives = data.alternatives.length;

        // 1. 计算准则层权重和一致性
        const criteriaMatrix2D = convertTo2DMatrix(data.criteriaMatrix, nCriteria);
        const { weights: criteriaWeights, lambdaMax: lambdaMaxCriteria } = calculateWeightsAndLambdaMax(criteriaMatrix2D);
        const ciCriteria = calculateCI(lambdaMaxCriteria, nCriteria);
        const crCriteria = calculateCR(ciCriteria, nCriteria);

        data.calculatedWeights.criteria = criteriaWeights;
        data.calculatedWeights.consistencyRatio_criteria = crCriteria;

        // 2. 计算方案层权重和一致性 (对每个准则)
        data.criteria.forEach((criterion, index) => {
            const matrixKey = `alternativesMatrix_C${index + 1}`;
            const altMatrix1D = data[matrixKey];
            if (altMatrix1D) {
                const altMatrix2D = convertTo2DMatrix(altMatrix1D, nAlternatives);
                const { weights: altWeights, lambdaMax: lambdaMaxAlt } = calculateWeightsAndLambdaMax(altMatrix2D);
                const ciAlt = calculateCI(lambdaMaxAlt, nAlternatives);
                const crAlt = calculateCR(ciAlt, nAlternatives);

                data.calculatedWeights[`alternatives_C${index + 1}`] = altWeights;
                data.calculatedWeights[`consistencyRatio_C${index + 1}`] = crAlt;
            } else {
                console.warn(`Warning: Missing alternative matrix for criterion ${criterion.id}. Using zero weights.`);
                data.calculatedWeights[`alternatives_C${index + 1}`] = new Array(nAlternatives).fill(0);
                data.calculatedWeights[`consistencyRatio_C${index + 1}`] = NaN;
            }
        });
    }

    // 执行 AHP 计算
    performAHPCalculations();

    // --- HTML 元素生成辅助函数 (与之前基本一致) ---

    function createMatrixTable(containerId, matrixData, labels, title) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const table = document.createElement("table");
        const caption = table.createCaption();
        caption.textContent = title;
        const thead = table.createTHead();
        const tbody = table.createTBody();

        const headerRow = thead.insertRow();
        headerRow.insertCell().textContent = "";
        labels.forEach(label => {
            const th = document.createElement("th");
            th.textContent = label.name;
            headerRow.appendChild(th);
        });

        const n = labels.length;
        for (let i = 0; i < n; i++) {
            const row = tbody.insertRow();
            const th = document.createElement("th");
            th.textContent = labels[i].name;
            row.appendChild(th);
            for (let j = 0; j < n; j++) {
                const cell = row.insertCell();
                const value = matrixData[i * n + j];
                cell.textContent = typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(3) : value;
            }
        }
        container.appendChild(table);
    }

    function createWeightAndConsistencyTable(containerId, labels, weights, consistencyRatio, title) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const table = document.createElement("table");
        const caption = table.createCaption();
        caption.textContent = title;
        const thead = table.createTHead();
        const tbody = table.createTBody();

        const headerRow = thead.insertRow();
        ["因素", "权重"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headerRow.appendChild(th);
        });

        labels.forEach((label, i) => {
            const row = tbody.insertRow();
            row.insertCell().textContent = label.name;
            row.insertCell().textContent = weights[i].toFixed(4);
        });

        container.appendChild(table);

        const consistencyDiv = document.getElementById(`consistency-${containerId.split('-')[1]}`);
        if(consistencyDiv) {
            const crText = document.createElement("p");
            let crMessage = '';
            if (isNaN(consistencyRatio)) {
                crMessage = `一致性比率 (CR): <strong>无法计算 (矩阵阶数过小或RI不存在)</strong>`;
                crText.style.color = "gray";
            } else {
                crMessage = `一致性比率 (CR): <strong>${consistencyRatio.toFixed(4)}</strong>`;
                if (consistencyRatio < 0.1) {
                    crMessage += ` (小于 0.1，通过一致性检验)`;
                    crText.style.color = "green";
                } else {
                    crMessage += ` (大于 0.1，未通过一致性检验，需要调整判断矩阵)`;
                    crText.style.color = "red";
                }
            }
            crText.innerHTML = crMessage;
            consistencyDiv.appendChild(crText);
        }
    }

    // 计算总排序权重
    function calculateOverallWeights() {
        const overallWeights = new Array(data.alternatives.length).fill(0);
        const criteriaWeights = data.calculatedWeights.criteria;

        data.alternatives.forEach((alt, altIndex) => {
            let sumAltWeight = 0;
            data.criteria.forEach((criterion, criterionIndex) => {
                const altWeightsForCriterion = data.calculatedWeights[`alternatives_C${criterionIndex + 1}`];
                if (altWeightsForCriterion && criteriaWeights[criterionIndex] !== undefined) {
                    sumAltWeight += criteriaWeights[criterionIndex] * altWeightsForCriterion[altIndex];
                }
            });
            overallWeights[altIndex] = sumAltWeight;
        });
        return overallWeights;
    }

    const overallWeights = calculateOverallWeights(); // 确保在所有权重计算完毕后调用

    function createOverallWeightsTable(containerId, labels, weights) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const table = document.createElement("table");
        const caption = table.createCaption();
        caption.textContent = "总排序权重";
        const thead = table.createTHead();
        const tbody = table.createTBody();

        const headerRow = thead.insertRow();
        ["方案", "总权重"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headerRow.appendChild(th);
        });

        const sortedResults = labels.map((label, i) => ({
            name: label.name,
            weight: weights[i]
        })).sort((a, b) => b.weight - a.weight);

        sortedResults.forEach(result => {
            const row = tbody.insertRow();
            row.insertCell().textContent = result.name;
            row.insertCell().textContent = result.weight.toFixed(4);
        });
        container.appendChild(table);
    }
    
    // 绘制总排序权重柱状图
    function createOverallWeightsChart(containerId, labels, weights) {
        const width = 600;
        const height = 300;
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };

        d3.select(`#${containerId}`).select("svg").remove(); // 清除旧图表

        const svg = d3.select(`#${containerId}`)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const sortedLabels = labels.map((label, i) => ({
            name: label.name,
            weight: weights[i]
        })).sort((a, b) => b.weight - a.weight);

        const x = d3.scaleBand()
            .domain(sortedLabels.map(d => d.name))
            .range([margin.left, width - margin.right])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(weights) * 1.1]).nice()
            .range([height - margin.bottom, margin.top]);

        svg.selectAll(".bar")
            .data(sortedLabels)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.name))
            .attr("y", d => y(d.weight))
            .attr("width", x.bandwidth())
            .attr("height", d => y(0) - y(d.weight))
            .attr("fill", "#007bff");

        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickFormat(d3.format(".2f")));

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.left / 2 - 20)
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("总权重");

        svg.selectAll(".bar-label")
            .data(sortedLabels)
            .enter().append("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.name) + x.bandwidth() / 2)
            .attr("y", d => y(d.weight) - 5)
            .attr("text-anchor", "middle")
            .text(d => d.weight.toFixed(4))
            .attr("fill", "#333");
    }

    function displayFinalResult() {
        const decisionTextElement = document.getElementById("decision-text");
        // 找到最大权重的方案
        const maxWeight = Math.max(...overallWeights);
        const bestAlternative = data.alternatives[overallWeights.indexOf(maxWeight)];

        decisionTextElement.innerHTML = `根据层次分析法，综合各方面考量，推荐选择 <strong>${bestAlternative.name}</strong> (总权重: ${maxWeight.toFixed(4)})。`;
    }

    // --- 调用所有展示函数 ---

    // 准则层判断矩阵
    createMatrixTable("matrix-criteria", data.criteriaMatrix, data.criteria, "准则层判断矩阵");

    // 方案层判断矩阵
    data.criteria.forEach((criterion, index) => {
        const matrixKey = `alternativesMatrix_C${index + 1}`;
        const containerId = `matrix-alternatives-C${index + 1}`;
        createMatrixTable(containerId, data[matrixKey], data.alternatives, `方案层对准则 ${criterion.name} 的判断矩阵`);
    });

    // 准则层权重和一致性检验
    createWeightAndConsistencyTable(
        "weights-criteria",
        data.criteria,
        data.calculatedWeights.criteria,
        data.calculatedWeights.consistencyRatio_criteria,
        "准则层权重"
    );

    // 方案层权重和一致性检验
    data.criteria.forEach((criterion, index) => {
        const weightsKey = `alternatives_C${index + 1}`;
        const crKey = `consistencyRatio_C${index + 1}`;
        const containerId = `weights-alternatives-C${index + 1}`;
        createWeightAndConsistencyTable(
            containerId,
            data.alternatives,
            data.calculatedWeights[weightsKey],
            data.calculatedWeights[crKey],
            `方案层对准则 ${criterion.name} 的权重`
        );
    });

    // 总排序权重表格
    createOverallWeightsTable("overall-weights-table", data.alternatives, overallWeights);

    // 总排序权重柱状图
    createOverallWeightsChart("overall-weights-chart", data.alternatives, overallWeights);

    // 最终决策结果
    displayFinalResult();
});