import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load swear words from file
with open("swearwords.txt", "r") as file:
    swear_words = [word.strip().lower() for word in file.readlines()]

# Define intents
intents = discord.Intents.default()
intents.members = True  # Enable member-related intents

# Bot prefix
bot = commands.Bot(command_prefix="/", intents=intents)

# Filters toggle
filters_enabled = False
swear_filter_enabled = False
link_filter_enabled = False
spam_filter_enabled = False

# Toggle all filters on
@bot.command()
async def filters_on(ctx):
    global filters_enabled
    global swear_filter_enabled
    global link_filter_enabled
    global spam_filter_enabled
    filters_enabled = True
    swear_filter_enabled = True
    link_filter_enabled = True
    spam_filter_enabled = True
    await ctx.send("All filters are now enabled.")

# Toggle all filters off
@bot.command()
async def filters_off(ctx):
    global filters_enabled
    global swear_filter_enabled
    global link_filter_enabled
    global spam_filter_enabled
    filters_enabled = False
    swear_filter_enabled = False
    link_filter_enabled = False
    spam_filter_enabled = False
    await ctx.send("All filters are now disabled.")

# Command to kick a member
@bot.command()
@commands.has_permissions(kick_members=True)
async def kick(ctx, member: discord.Member, *, reason="No reason provided"):
    await member.kick(reason=reason)
    await ctx.send(f"{member} has been kicked for: {reason}.")

# Command to ban a member
@bot.command()
@commands.has_permissions(ban_members=True)
async def ban(ctx, member: discord.Member, *, reason="No reason provided"):
    await member.ban(reason=reason)
    await ctx.send(f"{member} has been banned for: {reason}.")

# Command to make the bot say something
@bot.command()
async def say(ctx, *, message):
    await ctx.send(message)

# Command to check bot status
@bot.command()
async def ping(ctx):
    latency = round(bot.latency * 1000)  # Convert to milliseconds
    await ctx.send(f'Pong! Latency: {latency}ms')

# Command to add a role to a member
@bot.command()
@commands.has_permissions(manage_roles=True)
async def add_role(ctx, member: discord.Member, role: discord.Role):
    await member.add_roles(role)
    await ctx.send(f"{member.mention} has been given the {role.name} role.")

# Command to remove a role from a member
@bot.command()
@commands.has_permissions(manage_roles=True)
async def remove_role(ctx, member: discord.Member, role: discord.Role):
    await member.remove_roles(role)
    await ctx.send(f"{member.mention} no longer has the {role.name} role.")

# Command to add all roles to a member
@bot.command()
@commands.has_permissions(manage_roles=True)
async def add_all_roles(ctx, member: discord.Member):
    for role in ctx.guild.roles:
        if not role.permissions.administrator and not role.permissions.manage_roles:
            await member.add_roles(role)
    await ctx.send(f"All self-assignable roles have been added to {member.mention}.")

# Command to remove all roles from a member
@bot.command()
@commands.has_permissions(manage_roles=True)
async def remove_all_roles(ctx, member: discord.Member):
    for role in ctx.guild.roles:
        if not role.permissions.administrator and not role.permissions.manage_roles:
            await member.remove_roles(role)
    await ctx.send(f"All self-assignable roles have been removed from {member.mention}.")

# Command to allow users to assign themselves roles
@bot.command()
async def add_self_role(ctx, role: discord.Role):
    if role in ctx.author.roles:
        await ctx.send(f"You already have the {role.name} role.")
    elif role.permissions.administrator or role.permissions.manage_roles:
        await ctx.send(f"You cannot assign the {role.name} role to yourself.")
    else:
        await ctx.author.add_roles(role)
        await ctx.send(f"{ctx.author.mention} has been given the {role.name} role.")

# Command to allow users to remove roles from themselves
@bot.command()
async def remove_self_role(ctx, role: discord.Role):
    if role not in ctx.author.roles:
        await ctx.send(f"You don't have the {role.name} role.")
    elif role.permissions.administrator or role.permissions.manage_roles:
        await ctx.send(f"You cannot remove the {role.name} role from yourself.")
    else:
        await ctx.author.remove_roles(role)
        await ctx.send(f"{ctx.author.mention} no longer has the {role.name} role.")

# Event listener for message filter
@bot.event
async def on_message(message):
    if message.author == bot.user:
        return
    
    # Check if filters are enabled
    if filters_enabled:
        # Swear word filter
        if swear_filter_enabled:
            for word in swear_words:
                if word in message.content.lower():
                    await message.delete()
                    await message.channel.send(f"{message.author.mention}, please refrain from using offensive language.")
                    return  # Stop checking for more swear words
        
        # Link filter
        if link_filter_enabled:
            if "http" in message.content.lower():
                await message.delete()
                await message.channel.send(f"{message.author.mention}, please refrain from posting links.")
                return
        
        # Spam detection
        if spam_filter_enabled:
            author_id = message.author.id
            if author_id in spam_dict:
                spam_dict[author_id] += 1
            else:
                spam_dict[author_id] = 1
            
            if spam_dict[author_id] >= spam_threshold:
                await message.channel.send(f"{message.author.mention}, stop spamming!")
                await message.author.kick(reason="Spamming")
                del spam_dict[author_id]
                return
            
            await asyncio.sleep(spam_cooldown)
            if author_id in spam_dict:
                spam_dict[author_id] -= 1
                if spam_dict[author_id] <= 0:
                    del spam_dict[author_id]
    
    await bot.process_commands(message)

# Run the bot
bot.run(os.getenv('DISCORD_TOKEN'))

