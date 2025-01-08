require("dotenv").config();
const TelegramBot = require('node-telegram-bot-api');
const openai = require("openai");
const axios = require("axios");
const FromData = require("form-data");
const fs = require("fs");
const { sleep } = require("openai/core");
const tel = new openai({apiKey: process.env.API_KEY});

sendforText=async(zap)=>{
    const completion = await tel.chat.completions.create({
        messages: [{ role: "user", content: zap }],
        model: "gpt-3.5-turbo",
    });
    console.log(zap);
    console.log(completion.choices[0].message.content);
    return(completion.choices[0].message.content);
}

class Text2ImageAPI {
    constructor(url, api_key, secret_key) {
        this.URL = url;
        this.AUTH_HEADERS = {
            'X-Key': `Key ${api_key}`,
            'X-Secret': `Secret ${secret_key}`
        };
    }

    async get_model() {
        const response = await fetch(this.URL + 'key/api/v1/models', {
            method: 'GET',
            headers: this.AUTH_HEADERS
        })
        const data = await response.json();
        return data[0]['id'];
    }

    async generate(prompt, model, images=1, width=1024, height=1024, style=1) {
        const styles = ["KANDINSKY", "UHD", "ANIME", "DEFAULT", "STUDIOPHOTO"]
        const params = {
            type: "GENERATE",
            style: styles[style],
            width: width,
            num_images: 1,
            height: height,
            generateParams: {
                query: prompt
            }
        }
        console.log(styles[style]);
        const formData = new FromData();
        const modelIdData = {value: model, options: {contentType: null}};
        const paramsData = {value: JSON.stringify(params), options: {contentType: "application/json"}};
        formData.append("model_id", modelIdData.value, modelIdData.options);
        formData.append("params", paramsData.value, paramsData.options);



        const respons = await axios.post(this.URL + 'key/api/v1/text2image/run', formData, {
            headers: {
                ...formData.getHeaders(),
                ...this.AUTH_HEADERS
            },
            "Content-Type": "multipart/form-data"
        });
        const dat = respons.data;
        console.log(dat);
        return dat['uuid'];
    }

    async check_generation(request_id, attempts=100000, delay=100) {
        while (attempts > 0) {
            const response = await fetch(this.URL + 'key/api/v1/text2image/status/'+ request_id, {
                method: 'GET',
                headers: this.AUTH_HEADERS
            })
            const data = await response.json();
            if (data['status'] == 'DONE') {
                console.log("GOTOV");
                return data['images'];
            }
            console.log(request_id);
            attempts -= 1;
            await sleep(delay);
        }

        async function sleep(milliseconds) {
            const date = Date.now();
            let currentDate = null;
            do {
              currentDate = Date.now();
            } while (currentDate - date < milliseconds);
        }
    }
}
const api = new Text2ImageAPI('https://api-key.fusionbrain.ai/', process.env.api_key_fin, process.env.secret_fin);
const generatePhoto=async(prompt)=>{
    
    console.log("Создался класс");
    const model_id = await api.get_model();
    console.log("Получили ид модели");
    const uuid = await api.generate(prompt, model_id);
    console.log("генерируем");
    const images = await api.check_generation(uuid);
    console.log("Проверка генерации");
    const base64String = images[0];
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/,'');
    const buffer = Buffer.from(base64Data, "base64");

    fs.writeFile("image.jpg", buffer, "base64", (err)=>{
        if (err) throw err;
        console.log("Файл сохранен");
    })
    return buffer;
}

const bot = new TelegramBot(process.env.API_KEY_BOT, {
    polling: true 
});

bot.on('text', async msg => {

    try{
        if (msg.text=="/start")
            await bot.sendMessage(msg.chat.id, "Добро пожаловать в ChayGPT! 👋🏻");
        else if(msg.text.slice(0,4)=="/img"){
            let msgWait = await bot.sendMessage(msg.chat.id, "Придумываю изображение...");
            let text = msg.text.slice(6);
            let kol = parseInt(msg.text.slice(4,6));
            
            let zap = [];

            for (let i=0; i<kol; i++){ //5
                zap.push(generatePhoto(text));
            }

            responses = await Promise.all(zap);
            const delay = interval => new Promise(resolve => setTimeout(resolve, interval));

            const chunkSize = 9;
            for (let i = 0; i < responses.length; i += chunkSize) {
                const chunk = responses.slice(i, i + chunkSize);
                let med = [];
                for (let l=0; l<chunk.length;l++){
                    console.log(l);
                    if (l==0)
                        med.push({type: "photo", media: chunk[l], caption: `По запросу (${text}). Выполнено ${chunk.length+i}/${responses.length}`});
                    else med.push({type: "photo", media: chunk[l]});
                }
                
                async function sseenndd(msg, med){
                    let b = [...med];
                    try{
                        await bot.sendMediaGroup(msg.chat.id, b);
                    }catch(e){
                        if (e.response.body.error_code == 429){
                            console.log("vip1")
                            await delay(4000);
                            console.log("vi2")
                            await sseenndd(msg, b);
                        }
                    }
                }
                await sseenndd(msg, med);
            }
            await bot.deleteMessage(msgWait.chat.id, msgWait.message_id);
            // let msgWait = await bot.sendMessage(msg.chat.id, "Придумываю изображение...");
            // let text = msg.text.slice(6); //5
            // let zap = [];
            // let responses;
            // for (let i=0; i<parseInt(msg.text.slice(4,6)); i++){ //5
            //     zap.push(generatePhoto(text));
            //     // let b = await generatePhoto(text);
            //     // await bot.sendPhoto(msg.chat.id, b);
            // }
            // responses = await Promise.all(zap);
            // zap1=[];
            // responses.map(async rt=>await bot.sendPhoto(msg.chat.id, rt));
            // await bot.deleteMessage(msgWait.chat.id, msgWait.message_id);
        }
        else if(typeof msg.text.slice(0,4) === 'string'){
            let msgWait = await bot.sendMessage(msg.chat.id, "Думаю...");
            let res = await sendforText(msg.text.slice(4));
            await bot.editMessageText(res, {
                chat_id: msgWait.chat.id,
                message_id: msgWait.message_id
            });
        }
        else{
            // let msgWait = await bot.sendMessage(msg.chat.id, "Думаю...");
            // let res = await sendforText(msg.text);
            // await bot.editMessageText(res, {
            //     chat_id: msgWait.chat.id,
            //     message_id: msgWait.message_id
            // });
        }
    }catch(e){
        console.log(e);
        await bot.sendMessage(msg.chat.id, "Ошибка, я сдох");
        await bot.sendMessage(msg.chat.id, "Готов ебашить дальше");
    }
})

