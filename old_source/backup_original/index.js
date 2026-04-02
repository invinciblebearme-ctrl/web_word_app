var toolsData = [];

// ✅ inline 이벤트용으로 반드시 window 에 등록
window.searchItems = function() {
    const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
    const filtered = toolsData.filter(tool =>
        tool.name.toLowerCase().includes(keyword) ||
        tool.category.toLowerCase().includes(keyword)
    );
    renderTools(filtered);
};

window.clearSearch = function() {
    document.getElementById("searchInput").value = "";
    renderTools(toolsData);
};

// ✅ JSON 로딩
var req = new XMLHttpRequest();
req.open("GET", "./json/indexList.json");
req.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
        toolsData = JSON.parse(this.response);
        renderTools(toolsData);
    }
};
req.send();

function renderTools(data) {
    const container = document.querySelector('.container');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;">검색 결과가 없습니다 😥</p>';
        return;
    }

    const categoryGroups = {};
    data.forEach(tool => {
        if (!categoryGroups[tool.category]) categoryGroups[tool.category] = [];
        categoryGroups[tool.category].push(tool);
    });

    for (const category in categoryGroups) {
        const title = document.createElement("p");
        title.className = "subtitle";
        title.style.textAlign = "left";
        title.style.fontWeight = "bold";
        title.style.fontSize = "18px";
        title.innerText = category;
        container.appendChild(title);

        let tools = categoryGroups[category];

        // 정확히 4개씩 잘라서 행(row) 생성
        for (let i = 0; i < tools.length; i += 4) {
            const row = document.createElement("div");
            row.classList.add("row");
            container.appendChild(row);

            const slice = tools.slice(i, i + 4);
            slice.forEach(tool => {
                const item = document.createElement("div");
                item.classList.add("item");

                item.innerHTML = `
                    <a href="${tool.url}" target="_blank">
                        <img src="${tool.img}" alt="${tool.name}" class="img" style="width:52px;height:52px;">
                    </a>
                    <p class="appName" style="text-align:center;font-size:13px;">${tool.name}</p>
                `;
                row.appendChild(item);
            });
        }
    }
}