# X-Ample Trainer Discord Bot

A comprehensive Discord bot for staff training, onboarding, and job vacancy management.

## 🚀 **Features**

### **Core Training System**
- **Interactive Onboarding**: Step-by-step training for different staff roles
- **Quiz System**: Automated testing with role-based questions
- **Prerequisites**: Role progression system (Support → Admin → SLT)
- **Branching Scenarios**: Interactive decision-making training
- **Progress Tracking**: Monitor training completion and quiz performance

### **Advanced Job Vacancy System**
- **Comprehensive Management**: Add, edit, delete, and list job vacancies
- **Application System**: Users can apply directly through Discord
- **Application Tracking**: Leadership can review and manage applications
- **Status Management**: Track application status (pending, review, interview, accepted, rejected)
- **Auto-Notifications**: Automatic alerts for new applications
- **Channel Configuration**: Set announcement channels for vacancies

### **Interface Improvements**
- **Rich Embeds**: Beautiful, informative Discord embeds with colors and formatting
- **Smart Pagination**: Navigate through job listings with interactive buttons
- **Dynamic Colors**: Color-coded embeds based on vacancy status and type
- **Deadline Tracking**: Visual indicators for urgent deadlines
- **Filtering System**: Find jobs by department, type, and location
- **Responsive Design**: Mobile-friendly interface with clear navigation

### **Leadership Tools**
- **Dashboard**: Real-time overview of server operations and metrics
- **Analytics**: Detailed reports on training progress, quiz performance, and applications
- **Staff Management**: View and manage staff members and their roles
- **Reporting System**: Generate comprehensive reports in multiple formats
- **Performance Tracking**: Monitor staff completion rates and activity

## 📋 **Commands**

### **User Commands**
- `/trainme` - Start training for a specific role
- `/quiz` - Take a quiz for role certification
- `/scenarios` - Practice decision-making scenarios
- `/jobs` - View available job openings with filtering
- `/apply` - Apply for a job vacancy

### **Leadership Commands**
- `/vacancies add` - Add new job vacancy
- `/vacancies edit` - Edit existing vacancy
- `/vacancies delete` - Delete vacancy
- `/vacancies list` - List all vacancies
- `/vacancies setchannel` - Set announcement channel
- `/vacancies announce` - Announce specific vacancy
- `/vacancies applications` - Manage job applications

### **Leadership Dashboard**
- `/leadership dashboard` - View leadership dashboard
- `/leadership analytics` - View detailed analytics
- `/leadership staff` - Manage staff members
- `/leadership reports` - Generate reports

### **Configuration Commands**
- `/config` - Configure bot settings (Config Role only)

## 🔐 **Access Control**

### **Role-Based Permissions**
- **XD | Support**: Basic training and quiz access
- **XD | Administrator**: Full training management + vacancy management
- **XD | SLT**: All permissions + leadership tools
- **Config Role**: Bot configuration access

### **Command Restrictions**
- **Public Commands**: `/trainme`, `/quiz`, `/scenarios`, `/jobs`, `/apply`
- **Leadership Commands**: All `/vacancies` subcommands, `/leadership` commands
- **Admin Commands**: `/config` and system management

## 💼 **Job Vacancy System Details**

### **Vacancy Information Stored**
- **Basic Details**: Title, department, description, requirements
- **Employment Info**: Type (full-time, part-time, contract, internship), location, salary
- **Timing**: Deadline, creation date, status
- **Metadata**: Unique ID, creator information

### **Application Process**
1. User views available jobs with `/jobs`
2. User applies with `/apply <vacancy_id> <message> <role>`
3. Leadership receives notification in configured channel
4. Leadership reviews application with `/vacancies applications view`
5. Leadership updates status with `/vacancies applications status`

### **Application Statuses**
- **Pending**: New application awaiting review
- **Under Review**: Application being evaluated
- **Interview Scheduled**: Candidate invited for interview
- **Accepted**: Application approved
- **Rejected**: Application declined
- **Withdrawn**: Candidate withdrew application

## 📊 **Leadership Dashboard Features**

### **Key Metrics**
- Total staff count and active training sessions
- Job vacancy statistics and application counts
- Training completion rates by role
- Real-time activity monitoring

### **Analytics Types**
- **Training Progress**: Completion rates and active sessions
- **Quiz Performance**: Success rates and question statistics
- **Job Applications**: Application volume and status distribution
- **Staff Activity**: Role completion and engagement metrics

### **Reporting Options**
- **Discord Embeds**: Rich, visual reports
- **Text Summaries**: Simple, copy-paste friendly format
- **Multiple Periods**: 7 days, 30 days, 90 days, or all-time data

## 🛠️ **Technical Details**

### **Dependencies**
- Discord.js v14+
- MongoDB for data persistence
- Node.js 16+

### **Environment Variables**
- `DISCORD_TOKEN` - Your Discord bot token
- `MONGODB_URI` - MongoDB connection string

### **Data Storage**
- **User Progress**: Training status, quiz results, role completion
- **Configuration**: Onboarding steps, quiz questions, vacancy settings
- **Applications**: Job applications with status tracking
- **Analytics**: Performance metrics and reporting data

## 🚀 **Getting Started**

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd X-Ample-Trainer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord token and MongoDB URI
   ```

4. **Configure your Discord server**
   - Create the required roles (XD | Support, XD | Administrator, XD | SLT)
   - Set up the Config Role
   - Invite the bot with appropriate permissions

5. **Start the bot**
   ```bash
   npm start
   ```

## 🔧 **Configuration**

### **Setting Up Training Content**
- Configure onboarding steps in `data.js`
- Add quiz questions for each role
- Set up branching scenarios for decision-making practice

### **Configuring Job Vacancies**
- Set announcement channel with `/vacancies setchannel`
- Add job positions with `/vacancies add`
- Configure auto-announcements for new vacancies

### **Customizing Leadership Tools**
- Adjust analytics periods and report formats
- Configure staff management permissions
- Set up automated reporting schedules

## 📈 **Future Enhancements**

### **Planned Features**
- **Automated Reminders**: Training completion notifications
- **Advanced Analytics**: Machine learning insights
- **Integration APIs**: Connect with external HR systems
- **Mobile App**: Companion mobile application
- **Multi-Server Support**: Manage multiple Discord servers

### **Customization Options**
- **Branding**: Custom colors and logos
- **Workflows**: Configurable approval processes
- **Templates**: Pre-built training and quiz templates
- **Localization**: Multi-language support

## 🤝 **Support**

For support, questions, or feature requests:
- Create an issue in the repository
- Contact the development team
- Check the documentation for common solutions

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for the X-Ample community** 