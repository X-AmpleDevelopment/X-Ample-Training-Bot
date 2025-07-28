# X-Ample Training Bot

A comprehensive Discord bot for training new staff members on their roles and responsibilities. Features interactive training, quizzes, prerequisites, branching scenarios, and MongoDB integration.

## 🚀 Features

- **Interactive Training**: Step-by-step onboarding with media support
- **Prerequisites System**: Enforce training progression (Support → Admin → SLT)
- **Branching Scenarios**: Interactive decision-making scenarios
- **Quiz System**: Text-based quizzes with automatic certification
- **Media Support**: Images and videos in training steps
- **MongoDB Integration**: Scalable database storage
- **Role Assignment**: Automatic "XD Certified" role assignment
- **Progress Tracking**: User progress and leaderboards
- **Admin Panel**: Configuration and statistics

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas account
- Discord Bot Token
- Pterodactyl Panel access

## 🔧 Pterodactyl Deployment

### 1. **Upload Files**
Upload all project files to your Pterodactyl server:
- `index.js`
- `commands.js`
- `data.js`
- `database.js`
- `package.json`
- `README.md`

### 2. **Environment Variables**
Set these environment variables in your Pterodactyl panel:

```env
DISCORD_TOKEN=your_discord_bot_token_here
MONGODB_URI=mongodb+srv://iamxample:Yamool2003!@eu-west-1-cluster.d50ic.mongodb.net/
```

### 3. **Startup Command**
Set the startup command in Pterodactyl:
```bash
npm install && npm start
```

### 4. **Node.js Version**
Ensure your Pterodactyl server is set to Node.js 18 or higher.

## 🎯 Bot Commands

### **User Commands**
- `/trainme role:XD | Support` - Start training for a role
- `/quiz role:XD | Support` - Take quiz for a role
- `/myprogress` - View your training progress
- `/trainingpath` - Show progression path and prerequisites
- `/leaderboard` - View certified users
- `/resources` - Get role-specific resources
- `/faq` - View frequently asked questions
- `/feedback message` - Send feedback to admins
- `/scenarios role:XD | Support` - Start branching scenarios

### **Admin Commands** (Config Role Only)
- `/dbstats` - View database statistics
- `/staffstats` - View staff certification stats
- `/setonboarding role:XD | Support steps:Step 1|Step 2` - Modify training
- `/setquiz role:XD | Support qapairs:Q1|A1|Q2|A2` - Modify quizzes
- `/setresource role:XD | Support links:link1 link2` - Modify resources
- `/addmedia role:XD | Support step:1 mediaurl:url mediatype:image` - Add media

## 🏗️ Architecture

### **Files Structure**
```
├── index.js          # Main bot entry point
├── commands.js       # All slash commands
├── data.js          # Data management & MongoDB integration
├── database.js      # MongoDB operations
├── package.json     # Dependencies & scripts
└── README.md        # This file
```

### **Database Collections**
- `user_status` - User training and certification status
- `user_quiz_progress` - Active quiz sessions
- `user_training_progress` - Active training sessions
- `config` - Bot configuration (training, quizzes, resources)

## 🔐 Security

- **Role-Based Permissions**: Config commands restricted to specific role
- **Prerequisites**: Enforced training progression
- **MongoDB Security**: Connection string includes authentication
- **Environment Variables**: Sensitive data stored securely

## 📊 Monitoring

### **Database Statistics**
Use `/dbstats` to monitor:
- Total users with status
- Active quiz sessions
- Active training sessions
- Configuration records

### **Logs**
Monitor these logs in Pterodactyl:
- Database connection status
- Command execution
- Error handling
- User interactions

## 🚨 Troubleshooting

### **Common Issues**

1. **Bot not responding**
   - Check Discord token in environment variables
   - Verify bot has proper permissions
   - Check Pterodactyl logs

2. **Database connection failed**
   - Verify MongoDB URI in environment variables
   - Check network connectivity
   - Ensure MongoDB Atlas IP whitelist

3. **Commands not working**
   - Check bot has application.commands scope
   - Verify slash commands are registered
   - Check user permissions

### **Log Locations**
- Pterodactyl console logs
- MongoDB Atlas logs
- Discord Developer Portal

## 🔄 Updates

### **Updating the Bot**
1. Upload new files to Pterodactyl
2. Restart the server
3. Monitor logs for any errors
4. Test commands to ensure functionality

### **Database Migrations**
- MongoDB automatically handles schema changes
- No manual migration required
- Data is preserved across updates

## 📞 Support

For issues or questions:
- Check Pterodactyl logs
- Verify environment variables
- Test database connectivity
- Review Discord bot permissions

## 🎉 Success Indicators

When properly deployed, you should see:
- ✅ "Connected to MongoDB successfully!"
- ✅ "Database indexes created successfully!"
- ✅ "Logged in as X-Ample Training#XXXX!"
- ✅ Commands responding in Discord
- ✅ Users able to start training

---

**Happy Training! 🚀** 