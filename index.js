require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');

async function runPuppeteer() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the reCAPTCHA API Demo page
  await page.goto('https://www.google.com/recaptcha/api2/demo');
  console.log('Going to captcha page');
  await page.waitForTimeout(4000);
  console.log('Page loaded');
  page.on('console', (msg) => {
    console.log(msg.text());
  });

  const frame = await page.frames().find((f) => f.name().startsWith('a-'));
  await frame.waitForSelector('div.recaptcha-checkbox-border');
  //click on checkbox to activate recaptcha
  await frame.click('div.recaptcha-checkbox-border');
  console.log('Captcha exists!');
  // wait for selector below
  console.log('Waiting for audio button');
  await frame.waitForSelector('.rc-button-audio');
  console.log('Audio button exists, clicking');
  await frame.click('#recaptcha-audio-button');
  console.log('Waiting for download link selector');
  await frame.waitForSelector('.rc-audiochallenge-tdownload-link');
  console.log('Download button exists');
  const audioUrl = await frame.evaluate(() => {
    let downloadLink = document.querySelector(
      '.rc-audiochallenge-tdownload-link',
    );
    return downloadLink.href;
  });

  const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
  const audioData = Buffer.from(response.data, 'binary');
  fs.writeFileSync('./audio.mp3', audioData);

  const openaiResponse = await axios.post(
    'https://api.openai.com/v1/engines/davinci-codex/completions',
    {
      audioData: './audio.mp3',
      headers: {
        'Content-Type': 'audio/mp3',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    },
  );

  console.log(openaiResponse.data);
  const text = openaiResponse.data.choices[0].text;
  console.log(text, 'text');
  await browser.close();
}

runPuppeteer();
