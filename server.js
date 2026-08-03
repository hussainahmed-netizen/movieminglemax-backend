const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// CORS এনাবল করা যাতে আপনার ওয়েবসাইট থেকে রিকোয়েস্ট এক্সেপ্ট হয়
app.use(cors());

app.get('/api/extract', async (req, res) => {
    const { id, type = 'movie', season, episode } = req.query;

    if (!id) {
        return res.status(400).json({ success: false, message: 'TMDB ID (id) is required' });
    }

    // VidLink URL ফরম্যাট করা
    let embedUrl = `https://vidlink.pro/movie/${id}`;
    if (type === 'tv' && season && episode) {
        embedUrl = `https://vidlink.pro/tv/${id}/${season}/${episode}`;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        // হেডার সেট করা
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        let extractedStreamUrl = null;

        // ব্যাকগ্রাউন্ড নেটওয়ার্ক ট্রাফিক মনিটর করা (.m3u8 খুঁজে বের করার জন্য)
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') && !extractedStreamUrl) {
                extractedStreamUrl = url;
            }
        });

        // VidLink পেজে যাওয়া
        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 20000 });

        // পেজের ভিডিও এলিমেন্টে ফেক ক্লিক করে স্ট্রিম লোড করানো (যদি প্রয়োজন হয়)
        try {
            await page.click('body');
        } catch (e) {
            // ক্লিক না হলেও সমস্যা নেই
        }

        // ২ সেকেন্ড ওয়েট করা নিশ্চিত হওয়ার জন্য
        await new Promise(resolve => setTimeout(resolve, 2000));

        await browser.close();

        if (extractedStreamUrl) {
            return res.json({
                success: true,
                tmdbId: id,
                streamUrl: extractedStreamUrl
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'No .m3u8 stream found or video is protected.'
            });
        }

    } catch (error) {
        if (browser) await browser.close();
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});