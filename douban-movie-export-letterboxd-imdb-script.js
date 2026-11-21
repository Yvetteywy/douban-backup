(async function exportDoubanToLetterboxdAndIMDb() {
    // ====== 可按需修改的分段参数 ======
    const START_INDEX = 0;   // 从第几部开始抓（默认 0，分段时可改成 350）
    const MAX_COUNT = 75;   // 本次最多抓多少部（建议每次 300-400 部最稳妥）
    // ================================

    const pathMatch = location.pathname.match(/\/people\/([^\/]+)\/collect/);
    if (!pathMatch) {
        alert("请先进入你自己的豆瓣【我看过的电影】(/collect) 页面再运行！");
        return;
    }
    const userId = pathMatch.at(1);

    const lbRows = [["imdbID", "Title", "Year", "Rating", "WatchedDate", "Review"]];
    const imdbRows = [["Const", "Your Rating", "Date Rated", "Title"]];

    // 挂载紧急导出函数到全局，随时可在控制台输入 downloadNow() 保存已抓数据
    window.downloadNow = function() {
        const dateTag = new Date().toISOString().slice(0,10);
        const saveCsv = (rows, filename) => {
            const csvContent = "\uFEFF" + rows.map(row =>
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
            ).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        };
        saveCsv(lbRows, `letterboxd_part_${START_INDEX}_${dateTag}.csv`);
        setTimeout(() => {
            saveCsv(imdbRows, `imdb_part_${START_INDEX}_${dateTag}.csv`);
        }, 500);
        console.log(`💾 已保存当前抓取的 ${lbRows.length - 1} 部电影！`);
    };

    let start = START_INDEX;
    let grabbed = 0;
    console.log(`🚀 开始从第 ${START_INDEX + 1} 部抓取（本次上限 ${MAX_COUNT} 部）。如遇验证码可随时输入 downloadNow() 保存已抓数据...`);

    while (grabbed < MAX_COUNT) {
        const listUrl = `https://movie.douban.com/people/${userId}/collect?start=${start}&sort=time&rating=all&filter=all&mode=grid`;
        const res = await fetch(listUrl);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");
        const items = doc.querySelectorAll(".grid-view .item");

        if (items.length === 0) {
            console.log("🎉 已到达列表末尾，全部抓取完毕！");
            break;
        }

        for (const item of items) {
            if (grabbed >= MAX_COUNT) break;

            const titleEl = item.querySelector(".title a");
            const movieUrl = titleEl?.href || "";
            const titleRaw = titleEl?.innerText.trim() || "";
            const titleParts = titleRaw.split("/").map(s => s.trim());
            const title = titleParts.length > 1 ? titleParts.at(1) : titleParts.at(0);

            const intro = item.querySelector(".intro")?.innerText || "";
            const yearMatch = intro.match(/^(\d{4})/);
            const year = yearMatch ? yearMatch.at(1) : "";

            const ratingEl = item.querySelector("[class^='rating']");
            const ratingMatch = ratingEl?.className.match(/rating(\d)-t/);
            const lbRating = ratingMatch ? ratingMatch.at(1) : "";
            const imdbRating = lbRating ? String(Number(lbRating) * 2) : "";

            const date = item.querySelector(".date")?.innerText.trim() || "";
            const comment = item.querySelector(".comment")?.innerText.trim() || "";

            let imdbId = "";
            if (movieUrl) {
                try {
                    const detailRes = await fetch(movieUrl);
                    const detailText = await detailRes.text();
                    // 检测是否触发豆瓣风控验证码
                    if (detailText.includes("://douban.com") || detailText.includes("异常请求")) {
                        console.error("⚠️ 触发豆瓣安全验证！正在自动为你保存已抓取的数据...");
                        window.downloadNow();
                        return;
                    }
                    const imdbMatch = detailText.match(/IMDb:<\/span>\s*(tt\d+)/);
                    if (imdbMatch) {
                        imdbId = imdbMatch.at(1);
                    }
                    // 随机延时 1.2 ~ 2.0 秒，模拟真人浏览节奏
                    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
                } catch (e) {
                    console.warn(`获取《${title}》详情失败，跳过 IMDb ID`);
                }
            }

            lbRows.push([imdbId, title, year, lbRating, date, comment]);
            if (imdbId) {
                imdbRows.push([imdbId, imdbRating, date, title]);
            }

            grabbed++;
            console.log(`[${START_INDEX + grabbed}] ${title} | IMDb: ${imdbId || "无"} | 评分: ${lbRating || "未评"}`);
        }

        start += 15;
        await new Promise(r => setTimeout(r, 1500));
    }

    window.downloadNow();
})();
