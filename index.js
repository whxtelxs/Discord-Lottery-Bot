const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const config = require('./config.json');
const CHANNEL_ID = config.channelId;
const LOTTERY_FILE = 'lottery.json';
const LOTTERY_SETTINGS = 'lottery_settings.json';

let participants = new Set();
let lotteryEnd = null;
let lotteryMessage = null;
let settings = {};

// Запуск бота
// 
client.once('ready', async () => {
    console.log('Бот запущен!');
    try {
        await loadSettings();
        if (settings.giveStatus === 'close') {
            console.log('Розыгрыш уже завершён. Не требуется дальнейших действий.');
            return;
        }
        const messageId = await loadLotteryData();
        if (messageId) {
            const channel = client.channels.cache.get(CHANNEL_ID);
            if (channel) {
                const msg = await channel.messages.fetch(messageId);
                lotteryMessage = msg;
                continueLottery();
            }
        } else {
            console.log('Нет данных о предыдущем розыгрыше.');
        }
    } catch (error) {
        console.error('Ошибка при загрузке данных лотереи:', error);
    }
});

// Подгрузка файла с настройками розыгрыша, либо создание его
// 
async function loadSettings() {
    try {
        const data = await fs.readFile(LOTTERY_SETTINGS, 'utf8');
        settings = JSON.parse(data);
    } catch (error) {
        console.error('Ошибка при загрузке настроек лотереи:', error);
        settings = { prize: '1000 MC', winners: 5, duration: 86400000, giveStatus: 'close' }; // Стандартные настройки
        await saveSettings();
    }
}

// Функция для сохранения данных 
// 
async function saveSettings() {
    await fs.writeFile(LOTTERY_SETTINGS, JSON.stringify(settings));
}

// Сохранение данных о розыгрыше 
// 
async function saveLotteryData() {
    const data = {
        endTime: lotteryEnd.toISOString(),
        participants: Array.from(participants),
        messageId: lotteryMessage?.id
    };
    await fs.writeFile(LOTTERY_FILE, JSON.stringify(data));
}

// Подгрузка данных о розыгрыше
// 
async function loadLotteryData() {
    try {
        const data = await fs.readFile(LOTTERY_FILE, 'utf8');
        const savedData = JSON.parse(data);
        participants = new Set(savedData.participants);
        lotteryEnd = new Date(savedData.endTime);
        return savedData.messageId;
    } catch (error) {
        console.error('Ошибка при загрузке данных лотереи:', error);
        return null;
    }
}

// Запуск розыгрыша
// 
function startLottery() {
    lotteryEnd = new Date(Date.now() + settings.duration);
    sendLotteryMessage();
    continueLottery();
}

// Проверка закончен розыгрыш или нет
// 
function continueLottery() {
    const timeLeft = lotteryEnd.getTime() - Date.now();
    if (timeLeft > 0) {
        setTimeout(endLottery, timeLeft);
    } else {
        endLottery();
    }
}

// Создание сообщения о розыгрыше
// 
function createLotteryEmbed(lastParticipant) {
    const endTimeStamp = Math.floor(lotteryEnd.getTime() / 1000);
    let description = `🏆 Приз: **${settings.prize}**\n👥 Количество победителей: **${settings.winners}**\n👋 Количество участников: **${participants.size}**\n⏰ Время окончания: <t:${endTimeStamp}:R>`;

    if (lastParticipant) {
        description += `\n🔷 Последний участник: <@${lastParticipant}>`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎉 Розыгрыш!')
        .setDescription(description)
        .setFooter({ text: 'Участвуйте сейчас!' });

    return embed;
}

// Отправка сообщения с розыгрышем 
// 
async function sendLotteryMessage() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) return;

    const button = new ButtonBuilder()
        .setCustomId('participate')
        .setLabel('Участвовать')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = createLotteryEmbed();
    try {
        const msg = await channel.send({ content: '@everyone Новый розыгрыш начался!', embeds: [embed], components: [row] });
        lotteryMessage = msg;
        saveLotteryData();
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
    }
}

// Удаление ответа пользователю
// 
async function deleteInteractionReply(interaction) {
    try {
        await interaction.deleteReply();
    } catch (error) {
        console.error('Ошибка при удалении ответа пользователя:', error);
    }
}

// Функция для обновления сообщения
// 
function updateLotteryMessage(lastParticipant) {
    if (!lotteryMessage) return;
    const embed = createLotteryEmbed(lastParticipant);
    lotteryMessage.edit({ embeds: [embed] })
        .catch(console.error);
}

// Функция завершения розыгрыша
// 
function endLottery() {
    const winners = chooseWinners();
    const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎊 Розыгрыш завершен!')
        .setDescription(`🏅 Победители: ${winnerMentions}`);

    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
        channel.send({ embeds: [embed] })
            .catch(console.error);
    }
    participants.clear();
    lotteryMessage = null;
    settings.giveStatus = 'close';
    saveSettings();
}

// Функция для генерации рандомного победителя / выборе фиктивного победителя
// 
function chooseWinners() {
    if (settings.status === 'fake' && settings.fakeWinner) {
        const winners = [settings.fakeWinner];
        while (winners.length < settings.winners && participants.size > 0) {
            let randomWinner;
            do {
                randomWinner = Array.from(participants)[Math.floor(Math.random() * participants.size)];
            } while (winners.includes(randomWinner));
            winners.push(randomWinner);
        }
        return winners;
    } else {
        const participantsArray = Array.from(participants);
        const winners = [];
        for (let i = 0; i < settings.winners && participantsArray.length; i++) {
            const randomIndex = Math.floor(Math.random() * participantsArray.length);
            winners.push(participantsArray.splice(randomIndex, 1)[0]);
        }
        return winners;
    }
}

// Реакция на нажатие кнопки участвовать
//
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'participate') {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;

            if (participants.has(userId)) {
                await interaction.editReply({ content: 'Вы уже участвуете в этом розыгрыше!' });
            } else {
                participants.add(userId);
                saveLotteryData();
                updateLotteryMessage(userId);
                await interaction.editReply({ content: 'Вы участвуете в розыгрыше!' });
            }

            setTimeout(async () => {
                await deleteInteractionReply(interaction);
            }, 5000);
        } catch (error) {
            console.error('Ошибка при обработке взаимодействия:', error);
        }
    }
});

// Реакция на команду /endlottery
//
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'endlottery') return;

    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: 'У вас нет прав для выполнения этой команды.', ephemeral: true });
        return;
    }

    if (settings.giveStatus === 'close') {
        await interaction.reply({ content: 'Сейчас нет активного розыгрыша.', ephemeral: true });
        return;
    }

    settings.giveStatus = 'close';
    await saveSettings();

    endLottery();
    await interaction.reply({ content: 'Розыгрыш завершен!', ephemeral: true });
});

// Реакция на команду /startlottery
// 
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'startlottery') return;

    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: 'У вас нет прав для выполнения этой команды.', ephemeral: true });
        return;
    }

    if (settings.giveStatus === 'open') {
        await interaction.reply({ content: 'Розыгрыш уже запущен!', ephemeral: true });
        return;
    }

    const prize = interaction.options.getString('prize');
    const winners = interaction.options.getInteger('winners');
    const duration = interaction.options.getInteger('duration') * 60000;
    const status = interaction.options.getString('status');
    const fakeWinner = status === 'fake' ? interaction.options.getString('winner') : null;

    settings = { ...settings, prize, winners, duration, status, fakeWinner, giveStatus: 'open' };
    await saveSettings();

    startLottery();
    await interaction.reply({ content: 'Новый розыгрыш начат!', ephemeral: true });
    setTimeout(async () => {
        await deleteInteractionReply(interaction);
    }, 5000);
});

client.login(config.token);
