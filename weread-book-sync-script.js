(async function exportWeReadFinishedComplete() {

    console.log('🚀 正在读取微信读书书架数据...');

    const res = await fetch('https://weread.qq.com/web/shelf/sync?synckey=0&teenmode=0&album=1&onlyBookid=0', {
        credentials: 'include'
    });
    const data = await res.json();

    if (!data.books || data.books.length === 0) {
        alert('未获取到书架数据，请确认已登录并刷新书架页面后再试！');
        return;
    }

    const progressMap = new Map();
    if (Array.isArray(data.bookProgress)) {
        for (const p of data.bookProgress) {
            progressMap.set(p.bookId, p);
        }
    }

    const finishedBooks = data.books.filter(book => {
        const prog = progressMap.get(book.bookId);
        return book.finishReading === 1 || prog?.progress === 100;
    });

    if (finishedBooks.length === 0) {
        alert('未在书架中找到标记为“已读完”的书籍！');
        return;
    }

    console.log(`📚 共找到 ${finishedBooks.length} 本已读完的书籍，正在补齐 ISBN、评分与短评...`);

    const headers = [
        'Title', 'Author', 'ISBN', 'My Rating', 'Average Rating',
        'Publisher', 'Binding', 'Year Published', 'Original Publication Year',
        'Date Read', 'Date Added', 'Shelves', 'Bookshelves', 'My Review'
    ];
    const rows = [headers];

    const formatDate = (ts) => {
        if (!ts) return '';
        const d = new Date(ts * 1000);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    };

    const mapWeReadRating = (item, outerData) => {
        const rawVal = item?.newRatingLevel 
                    ?? item?.star 
                    ?? item?.rating 
                    ?? outerData?.myRating 
                    ?? outerData?.ratingLevel;

        if (rawVal === undefined || rawVal === null || rawVal === 0 || rawVal === '') return '';

        const num = Number(rawVal);
        if (num === 100 || num === 1 || rawVal === 'good' || rawVal === 'recommend') return '5';
        if (num === 50 || num === 2 || rawVal === 'fair' || rawVal === 'average') return '3';
        if (num === 10 || num === 3 || num === -1 || rawVal === 'bad' || rawVal === 'poor') return '1';
        if (num >= 1 && num <= 5) return String(num);
        return '';
    };

    let count = 0;

    for (const book of finishedBooks) {
        count++;
        const title = book.title || '';
        const author = book.author || '';
        let isbn = book.isbn || '';
        let publisher = book.publisher || '';
        let publishYear = book.publishTime ? book.publishTime.slice(0, 4) : '';

        const prog = progressMap.get(book.bookId);
        const dateRead = formatDate(book.readUpdateTime || prog?.updateTime);

        let myRating = '';
        let myReview = '';

        try {
            // 1. 如果书架信息里没有 ISBN，则请求单本书籍详情接口补齐 ISBN
            if (!isbn) {
                const infoRes = await fetch(`https://weread.qq.com/web/book/info?bookId=${book.bookId}`, {
                    credentials: 'include'
                });
                const infoData = await infoRes.json();
                if (infoData) {
                    isbn = infoData.isbn || '';
                    if (!publisher && infoData.publisher) publisher = infoData.publisher;
                    if (!publishYear && infoData.publishTime) publishYear = infoData.publishTime.slice(0, 4);
                }
            }

            // 2. 请求单本书的个人点评与推荐度接口
            const reviewRes = await fetch(`https://weread.qq.com/web/review/list?bookId=${book.bookId}&listType=11&mine=1&synckey=0`, {
                credentials: 'include'
            });
            const reviewData = await reviewRes.json();

            if (Array.isArray(reviewData.reviews) && reviewData.reviews.length > 0) {
                const myItem = reviewData.reviews.at(0)?.review;
                if (myItem) {
                    myReview = myItem.content || '';
                    myRating = mapWeReadRating(myItem, reviewData);
                }
            }

            if (!myRating) {
                myRating = mapWeReadRating(book, null);
            }

            await new Promise(r => setTimeout(r, 800));
        } catch (e) {
            console.warn(`获取《${title}》详情或短评失败`);
        }

        rows.push([
            title, author, isbn, myRating, '',
            publisher, '', publishYear, publishYear,
            dateRead, dateRead, 'read', 'weread', myReview
        ]);

        const preview = myReview ? myReview.slice(0, 10) + '...' : '无';
        console.log(`[${count}/${finishedBooks.length}] 《${title}》 | ISBN:${isbn || '无'} | 星级:${myRating || '未评'} | 短评:${preview}`);
    }

    const quoteChar = String.fromCharCode(34);
    const csvContent = rows.map(row =>
        row.map(cell => quoteChar + String(cell).split(quoteChar).join(quoteChar + quoteChar) + quoteChar).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `weread_complete_goodreads_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();

    console.log(`✅ 导出完成！共导出 ${rows.length - 1} 本已读完书籍。`);
})();
