const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./config.json');

const commands = [
    {
        name: 'endlottery',
        description: 'Завершить текущий розыгрыш'
    },
    {
        name: 'startlottery',
        description: 'Начать новый розыгрыш',
        options: [
            {
                name: 'prize',
                description: 'Приз',
                type: 3, // строка
                required: true
            },
            {
                name: 'winners',
                description: 'Количество участников',
                type: 4, // целое число
                required: true
            },
            {
                name: 'duration',
                description: 'Продолжительность в минутах',
                type: 4, // целое число
                required: true
            },
            {
                name: 'status',
                description: 'Статус розыгрыша (real или fake)',
                type: 3, // строка
                required: true,
                choices: [
                    {
                        name: 'Real',
                        value: 'real'
                    },
                    {
                        name: 'Fake',
                        value: 'fake'
                    }
                ]
            },
            {
                name: 'winner',
                description: 'Победитель (только для fake)',
                type: 3, // целое число
                required: false
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('Начало регистрации слеш-команд (/) для бота.');

        await rest.put(
            Routes.applicationGuildCommands(config.applicationId, config.serverId),
            { body: commands },
        );

        console.log('Слеш-команды (/) успешно зарегистрированы для бота.');
    } catch (error) {
        console.error(error);
    }
})();
