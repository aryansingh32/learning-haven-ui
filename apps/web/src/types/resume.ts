export interface ResumeData {
    personalInfo: {
        fullName: string;
        role: string;
        summary: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        github: string;
        portfolio: string;
        avatarUrl?: string;
    };
    education: Array<{
        id: string;
        institution: string;
        degree: string;
        location: string;
        year: string;
        gpa: string;
    }>;
    experience: Array<{
        id: string;
        role: string;
        company: string;
        location: string;
        duration: string;
        description: string;
    }>;
    projects: Array<{
        id: string;
        title: string;
        techStack: string;
        link: string;
        duration: string;
        description: string;
    }>;
    skills: {
        languages: string;
        frameworks: string;
        tools: string;
        softSkills: string;
    };
    certificates: Array<{
        id: string;
        title: string;
        issuer: string;
        year: string;
        link: string;
    }>;
    languages: Array<{
        id: string;
        name: string;
        proficiency: string; // Native, Fluent, Beginner, etc.
    }>;
    interests: string; // Comma separated
    references: Array<{
        id: string;
        name: string;
        role: string;
        company: string;
        contact: string;
    }>;
}

export const defaultResumeData: ResumeData = {
    personalInfo: { fullName: '', role: '', summary: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '', avatarUrl: '' },
    education: [],
    experience: [],
    projects: [],
    skills: { languages: '', frameworks: '', tools: '', softSkills: '' },
    certificates: [],
    languages: [],
    interests: '',
    references: []
};
