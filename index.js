require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const request = require('request');

async function runPuppeteer() {
  const browser = await puppeteer.launch({ headless: false });
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();

  // Navigate to the reCAPTCHA API Demo page
  await page.goto('https://www.google.com/recaptcha/api2/demo');
  console.log('Going to captcha page');
  await page.waitForTimeout(4000);
  console.log('Page loaded');

  const frame = await page.frames().find((f) => f.name().startsWith('a-'));
  await frame.waitForSelector('div.recaptcha-checkbox-border');
  //click on checkbox to activate recaptcha
  await frame.click('div.recaptcha-checkbox-border');
  console.log('Captcha exists!');

  // Switch to the new iframe for the challenge
  await page.waitForTimeout(3000); // Wait for new iframe to load

  // Find the iframe by its XPath
  const iframeElementHandle = await page.$x(
    ".//iframe[@title='recaptcha challenge expires in two minutes']",
  );

  // Get the frame from the element handle
  const secondaryIframe = await iframeElementHandle[0].contentFrame();
  await secondaryIframe.waitForSelector('.rc-button-audio');
  await secondaryIframe.click('.rc-button-audio');
  console.log('Audio button clicked');
  await secondaryIframe.waitForSelector('.rc-audiochallenge-tdownload-link');
  const audioUrl = await secondaryIframe.evaluate(() => {
    let downloadLink = document.querySelector(
      '.rc-audiochallenge-tdownload-link',
    );
    return downloadLink.href;
  });

  const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
  const audioData = Buffer.from(response.data, 'binary');
  fs.writeFileSync('./audio.wav', audioData);

  // Send the audio file to OpenAI's Whisper API

  const formData = {
    model: 'whisper-1',
    file: {
      value: fs.createReadStream('./audio.wav'),
      options: {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      },
    },
  };

  const options = {
    method: 'POST',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_KEY}`,
    },
    formData: formData,
  };
  let audioText = '';

  request(options, async function (error, response, body) {
    if (error) {
      console.error(error);
    } else {
      console.log(body, 'body');
      audioText = JSON.parse(body).text;
      console.log(audioText, 'audio text');
      await secondaryIframe.waitForSelector('#audio-response');
      await secondaryIframe.type('#audio-response', audioText, 500);
      await secondaryIframe.click('#recaptcha-verify-button');
    }
  });

  await page.waitForTimeout(15000);
  await browser.close();
}

runPuppeteer();
