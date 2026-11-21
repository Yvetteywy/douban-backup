(async function exportDoubanBooksExactSample() {
    // ====== 可按需修改的分段参数 ======
    const START_INDEX = 300; // 从第几本开始抓（默认 0，分段时可改成 350）
    const MAX_COUNT = 100;   // 本次最多抓多少本
    // ================================

    const pathMatch = location.pathname.match(/\/people\/([^\/]+)\/(collect|wish)/);
    if (!pathMatch) {
        alert("请先进入你自己的豆瓣【我读过的书】(/collect) 或【我想读的书】(/wish) 页面再运行！");
        return;
    }
    const userId = pathMatch.at(1);
    const shelfType = pathMatch.at(2);
    const goodreadsShelf = shelfType === "collect" ? "read" : "to-read";

    // 100% 对齐官方示例的 14 个表头
    const headers = [
        "Title", "Author", "ISBN", "My Rating", "Average Rating",
        "Publisher", "Binding", "Year Published", "Original Publication Year",
        "Date Read", "Date Added", "Shelves", "Bookshelves", "My Review"
    ];
    const rows = [headers];

    window.downloadNow = function() {
        const dateTag = new Date().toISOString().slice(0,10);
        const csvContent = rows.map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `goodreads_exact_${goodreadsShelf}_${START_INDEX}_${dateTag}.csv`;
        link.click();
        console.log(`💾 已保存当前抓取的 ${rows.length - 1} 本书籍！`);
    };

    let start = START_INDEX;
    let grabbed = 0;
    console.log(`🚀 开始抓取【${goodreadsShelf}】书籍（100% 对齐官方示例模板）...`);

    while (grabbed < MAX_COUNT) {
        const listUrl = `https://book.douban.com/people/${userId}/${shelfType}?start=${start}&sort=time&rating=all&filter=all&mode=grid`;
        const res = await fetch(listUrl);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");
        const items = doc.querySelectorAll(".interest-list .subject-item");

        if (items.length === 0) {
            console.log("🎉 已到达书单末尾，全部抓取完毕！");
            break;
        }

        for (const item of items) {
            if (grabbed >= MAX_COUNT) break;

            const titleEl = item.querySelector(".info h2 a");
            const title = titleEl?.innerText.replace(/\s+/g, " ").trim() || "";
            const bookUrl = titleEl?.href || "";

            const pub = item.querySelector(".pub")?.innerText.trim() || "";
            const author = pub.split("/").at(0)?.trim() || "";

            // 提取评分（未评分留空，不填 0，与示例一致）
            let rating = "";
            const ratingEl = item.querySelector("[class*='rating']");
            if (ratingEl) {
                const ratingMatch = ratingEl.className.match(/rating([1-5])/);
                if (ratingMatch) rating = ratingMatch.at(1);
            }

            // 保留 YYYY-MM-DD 短横线格式（完全匹配示例里的 2007-02-14）
            const dateText = item.querySelector(".date")?.innerText || "";
            const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
            const formattedDate = dateMatch ? dateMatch.at(1) : "";

            const dateRead = shelfType === "collect" ? formattedDate : "";
            const dateAdded = formattedDate;

            // 提取短评
            let comment = "";
            const commentEl = item.querySelector(".short-note .comment-content")
                           || item.querySelector(".comment")
                           || item.querySelector("p.comment-item");
            if (commentEl) {
                comment = commentEl.innerText.replace(/\s*\(展开\)\s*$/, "").trim();
            }

            // 提取 ISBN
            let isbn = "";
            if (bookUrl) {
                try {
                    const detailRes = await fetch(bookUrl);
                    const detailText = await detailRes.text();
                    if (detailText.includes("://douban.com") || detailText.includes("异常请求")) {
                        console.error("⚠️ 触发豆瓣安全验证！正在自动为你保存已抓取的数据...");
                        window.downloadNow();
                        return;
                    }
                    const isbnMatch = detailText.match(/ISBN:<\/span>\s*(\d{10,13})/);
                    if (isbnMatch) {
                        isbn = isbnMatch.at(1);
                    }
                    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
                } catch (e) {
                    console.warn(`获取《${title}》ISBN 失败`);
                }
            }

            // 严格对应示例 14 列
            rows.push([
                title, author, isbn, rating, "",
                "", "", "", "",
                dateRead, dateAdded, goodreadsShelf, "", comment
            ]);

            grabbed++;
            const reviewPreview = comment ? comment.slice(0, 12) + "..." : "无";
            console.log(`[${START_INDEX + grabbed}] 《${title}》 | 星级:${rating || "无"} | 日期:${formattedDate || "无"} | 短评:${reviewPreview}`);
        }

        start += 15;
        await new Promise(r => setTimeout(r, 1500));
    }

    window.downloadNow();
})();
