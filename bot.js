const Discord = require('discord.js');
const { WebClient } = require('@slack/web-api');
const { RTMClient } = require('@slack/rtm-api');
const axios = require('axios')

const link = require('./link.json');

var cliargs = process.argv.slice(2);

const slack_token = link.slackToken;
const discord_token = link.discordToken;
const links = link.links;

const discord_webhook_id = cliargs[2];
const discord_webhook_token = cliargs[3];

const discord_channel_id = cliargs[4];
const slack_channel_id = cliargs[5];

let slack_bot_id = '';

const client = new Discord.Client();
const rtm = new RTMClient(slack_token);
const web = new WebClient(slack_token);

//Discord events
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async msg => {
    let slack_channel_id = null;
    for (let i = 0; i < links.length; i++) {
        if (links[i].discordChannelID == msg.channel.id) {
            slack_channel_id = links[i].slackChannelID
        }
    }
    if (slack_channel_id == null) return;
    data = {
        "channel": slack_channel_id,
        "text": msg.content,
        "icon_url": msg.author.displayAvatarURL,
        "username": msg.member.displayName,
        "blocks": []
    }

    if (msg.attachments.size != 0) {
        if (msg.content.length != 0) {
            data.blocks.push(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": msg.content
                    }
                });
        }
        msg.attachments.forEach(a => {
            if (a.filename.endsWith('.png') || a.filename.endsWith('.jpg') ||
                a.filename.endsWith('.bmp') || a.filename.endsWith('.jpeg')) {
                data.blocks.push({
                    "type": "image",
                    "title": {
                        "type": "plain_text",
                        "text": a.filename,
                        "emoji": true
                    },
                    "image_url": a.url,
                    "alt_text": a.filename
                })
            }
            else {
                data.blocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*<${a.url}|Attachment: ${a.filename}>*`
                    }
                })
            }
        });
    }
    try {
        await web.chat.postMessage(data);
    }
    catch (e) { console.log(e) }
});

//Slack events
rtm.on('ready', async () => {
    slack_bot_id = (await web.users.info({ "user": rtm.activeUserId })).user.profile.bot_id;
    console.log('Slack RTM logged in!');
});

rtm.on('message', async (event) => {
    if (event.bot_id != slack_bot_id && event.user != null) {
        let discord_webhook_id = null;
        let discord_webhook_token = null;
        console.log(event.channel);
        for (let i = 0; i < links.length; i++) {
            if (links[i].slackChannelID == event.channel) {
                discord_webhook_id = links[i].discordWebhookID
                discord_webhook_token = links[i].discordWebhookToken
            }
        }
        if (discord_webhook_id == null) return;
        userinfo = await web.users.info({ "user": event.user });
        client.fetchWebhook(discord_webhook_id, discord_webhook_token).then(async w => {
            let options = {
                username: userinfo.user.profile.display_name,
                avatarURL: userinfo.user.profile.image_512,
                files: []
            }
            if (event.files != null) {
                for (let i = 0; i < event.files.length; i++) {
                    let url = event.files[i].url_private_download;
                    const response = await axios({
                        url,
                        method: 'GET',
                        headers: {
                            Authorization: 'Bearer ' + slack_token
                        },
                        responseType: 'stream'
                    });
                    options.files.push(new Discord.Attachment(response.data, event.files[i].name))
                }
            }
            w.send(event.text, options);
        })
    }
});

//Start both bots
(async () => client.login(discord_token))();
rtm.start()
    .catch(console.error);