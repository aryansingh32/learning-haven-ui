const fs = require('fs');
const path = require('path');

const filesToProcess = [
    'src/modules/admin/controllers/admin.controller.ts',
    'src/modules/admin/routes/admin.ts',
    'src/modules/admin/services/admin-chapters.service.ts',
    'src/modules/apprenticeship/services/tasks.service.ts',
    'src/modules/auth/services/gamification.service.ts',
    'src/modules/core/routes/index.ts',
    'src/modules/learning/controllers/courses.controller.ts',
    'src/modules/learning/routes/chapters.ts',
    'src/modules/learning/routes/courses.ts',
    'src/modules/learning/services/chapters.service.ts',
    'src/modules/learning/services/courses.service.ts',
    'src/utils/plans.ts'
];

for (const relPath of filesToProcess) {
    const fullPath = path.join(__dirname, 'src', '..', relPath); // Cwd will be apps/api
    if (fs.existsSync(relPath)) {
        let content = fs.readFileSync(relPath, 'utf8');
        content = content.replace(/roadmap/g, 'course');
        content = content.replace(/Roadmap/g, 'Course');
        content = content.replace(/ROADMAP/g, 'COURSE');
        fs.writeFileSync(relPath, content);
        console.log(`Updated ${relPath}`);
    }
}
