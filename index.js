require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

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
  // Click on checkbox to activate reCAPTCHA
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

  // Fetch the audio file using fetch
  const audioResponse = await fetch(audioUrl);
  const audioData = await audioResponse.arrayBuffer();
  fs.writeFileSync('./audio.wav', Buffer.from(audioData));

  // Send the audio file to OpenAI's Whisper API using fetch
  const formData = new FormData();
  formData.append('model', 'whisper-1');
  formData.append('file', fs.createReadStream('./audio.wav'), {
    filename: 'audio.wav',
    contentType: 'audio/wav',
  });

  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_KEY}`,
    },
    body: formData,
  });

  if (!whisperResponse.ok) {
    console.error('Error sending audio to Whisper API:', await whisperResponse.text());
    await browser.close();
    return;
  }

  const whisperResult = await whisperResponse.json();
  const audioText = whisperResult.text;
  console.log(audioText, 'audio text');

  await secondaryIframe.waitForSelector('#audio-response');
  await secondaryIframe.type('#audio-response', audioText, 500);
  await secondaryIframe.click('#recaptcha-verify-button');

  await page.waitForTimeout(15000);
  await browser.close();
}

runPuppeteer();
