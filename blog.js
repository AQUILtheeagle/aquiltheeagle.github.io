const blogCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT_Cj4vExnwVY1yLiAtlskT2RDjL2GqBIor9p_poaCCINtuJn18OpzKUw2MPiqzIyHTrv9pQDQK28os/pub?gid=0&single=true&output=csv";
const blogPostsContainer = document.getElementById("blog-posts");

function parseCsv(csv) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let index = 0; index < csv.length; index += 1) {
        const character = csv[index];

        if (character === '"') {
            if (insideQuotes && csv[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (insideQuotes) {
                insideQuotes = false;
            } else if (field.length === 0) {
                insideQuotes = true;
            } else {
                field += character;
            }
        } else if (character === "," && !insideQuotes) {
            row.push(field);
            field = "";
        } else if ((character === "\n" || character === "\r") && !insideQuotes) {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
            if (character === "\r" && csv[index + 1] === "\n") {
                index += 1;
            }
        } else {
            field += character;
        }
    }

    if (insideQuotes) {
        throw new Error("The published CSV contains an unclosed quoted field.");
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

function createBlogPost(post, columns) {
    const article = document.createElement("article");
    article.className = "blog-post";

    const title = document.createElement("h2");
    title.textContent = post[columns.titolo];
    article.append(title);

    const date = post[columns.data].trim();
    const time = post[columns.ora].trim();
    if (date || time) {
        const dateElement = document.createElement("time");
        dateElement.textContent = [date, time].filter(Boolean).join(" · ");

        const dateParts = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        const timeParts = time.match(/^(\d{1,2}):(\d{2})$/);
        if (dateParts && timeParts) {
            const [, day, month, year] = dateParts;
            const [, hours, minutes] = timeParts;
            const dateValue = new Date(Number(year), Number(month) - 1, Number(day));
            if (
                dateValue.getFullYear() === Number(year) &&
                dateValue.getMonth() === Number(month) - 1 &&
                dateValue.getDate() === Number(day) &&
                Number(hours) < 24 &&
                Number(minutes) < 60
            ) {
                dateElement.dateTime =
                    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` +
                    `T${hours.padStart(2, "0")}:${minutes}`;
            }
        }

        article.append(dateElement);
    }

    const message = document.createElement("p");
    message.className = "blog-post-message";
    message.textContent = post[columns.messaggio];
    article.append(message);

    const imageUrls = post[columns.immagini]
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);

    if (imageUrls.length > 0) {
        const images = document.createElement("div");
        images.className = "blog-post-images";

        for (const imageUrl of imageUrls) {
            let parsedUrl;
            try {
                parsedUrl = new URL(imageUrl);
            } catch {
                throw new Error(`Invalid image URL in post "${post[columns.titolo]}".`);
            }

            if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
                throw new Error(`Unsupported image URL in post "${post[columns.titolo]}".`);
            }

            const image = document.createElement("img");
            image.src = parsedUrl.href;
            image.alt = post[columns.titolo];
            image.loading = "lazy";
            images.append(image);
        }

        article.append(images);
    }

    return article;
}

async function loadBlogPosts() {
    try {
        const response = await fetch(blogCsvUrl);
        if (!response.ok) {
            throw new Error(`The CSV request failed with status ${response.status}.`);
        }

        const rows = parseCsv(await response.text());
        if (rows.length === 0) {
            throw new Error("The published CSV is empty.");
        }

        const headers = rows[0].map((header) =>
            header.replace(/^\uFEFF/, "").trim().toLowerCase()
        );
        const requiredColumns = ["data", "ora", "titolo", "messaggio", "immagini"];
        const columns = Object.fromEntries(
            requiredColumns.map((column) => [column, headers.indexOf(column)])
        );
        const missingColumns = requiredColumns.filter((column) => columns[column] === -1);
        if (missingColumns.length > 0) {
            throw new Error(`Missing CSV columns: ${missingColumns.join(", ")}.`);
        }

        const posts = rows.slice(1).filter((post) =>
            post.some((value) => value.trim() !== "")
        );

        blogPostsContainer.replaceChildren();
        if (posts.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "There are no blog posts yet.";
            blogPostsContainer.append(emptyMessage);
            return;
        }

        for (const post of posts) {
            if (post.length < headers.length) {
                throw new Error("A blog post row has fewer values than the CSV header.");
            }
            blogPostsContainer.append(createBlogPost(post, columns));
        }
    } catch (error) {
        const errorMessage = document.createElement("p");
        errorMessage.textContent = `Could not load blog posts: ${error.message}`;
        blogPostsContainer.replaceChildren(errorMessage);
        console.error("Could not load blog posts.", error);
    }
}

loadBlogPosts();
