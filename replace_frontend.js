const fs = require('fs');
const path = require('path');

const webFiles = [
    'apps/web/src/App.tsx',
    'apps/web/src/data/chapters.ts',
    'apps/web/src/features/learning/components/CelebrationOverlay.tsx',
    'apps/web/src/features/learning/components/LinkedInAchievementCard.tsx',
    'apps/web/src/hooks/useLearnCourse.ts',
    'apps/web/src/index.css',
    'apps/web/src/lib/gamification.ts',
    'apps/web/src/pages/ChapterPage.tsx',
    'apps/web/src/pages/ChaptersOverviewPage.tsx',
    'apps/web/src/pages/CoursesCatalogPage.tsx',
    'apps/web/src/pages/Index.tsx',
    'apps/web/src/pages/LandingPage.tsx',
    'apps/web/src/pages/LearnChapterPage.tsx',
    'apps/web/src/pages/Onboarding.tsx',
    'apps/web/src/pages/CoursePreview.tsx'
];

const adminFiles = [
    'apps/admin/src/App.tsx',
    'apps/admin/src/components/Sidebar.tsx',
    'apps/admin/src/layouts/DashboardLayout.tsx',
    'apps/admin/src/pages/Chapters.tsx',
    'apps/admin/src/pages/Courses.tsx',
    'apps/admin/src/services/chapters.service.ts',
    'apps/admin/src/services/courses.service.ts'
];

for (const relPath of [...webFiles, ...adminFiles]) {
    const fullPath = path.join(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/roadmap/g, 'course');
        content = content.replace(/Roadmap/g, 'Course');
        content = content.replace(/ROADMAP/g, 'COURSE');
        // Let's also fix the import names that might have been changed
        content = content.replace(/useLearnRoadmap/g, 'useLearnCourse');
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${relPath}`);
    } else {
        console.log(`File not found: ${fullPath}`);
    }
}
