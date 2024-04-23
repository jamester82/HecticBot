# HecticBot

This is a Discord bot that performs various tasks such as moderation and message filtering.

## Setup

### 1. Clone the repository

git clone https://github.com/jamester82/HecticBot.git


### 2. Install dependencies

Navigate to the project directory and install the required dependencies using pip:

pip install -r requirements.txt


### 3. Set up environment variables

Create a `.env` file in the root directory of the project and add your Discord bot token:

DISCORD_TOKEN=your_discord_bot_token


### 4. Run the bot

Run the bot using the following command:

bot.py


Your bot should now be up and running on your Discord server!

## Features

- Moderation commands: Kick, ban
- Message filtering: Swear word filter, link filter, spam filter
- Self-assignable roles

## Self-assignable roles

To assign yourself a role, use the following command:

/add_self_role role_name


To remove a role from yourself, use the following command:

/remove_self_role role_name

Replace `role_name` with the name of the role you want to assign or remove. Note that you cannot assign or remove roles with moderation permissions (administrator or manage_roles) yourself.

