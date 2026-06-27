import OpenAI from 'openai';
import pdf from 'pdf-parse';
import env from '../config/env';
import Employee from '../models/Employee';
import Job from '../models/Job';
import { ApiError } from '../utils/apiError';
import { IEmployee, IJob } from '../types';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

interface ParsedResume {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current: boolean;
    description?: string;
  }[];
  education: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate?: string;
    endDate?: string;
    current: boolean;
  }[];
  bio?: string;
  headline?: string;
}

interface MatchScore {
  overall: number; // 0-100
  breakdown: {
    skills: number;
    experience: number;
    location: number;
    salary: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
}

class AIService {
  /** Extracts text from a PDF buffer using pdf-parse */
  async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    const data = await (pdf as any)(pdfBuffer);
    return data.text;
  }

  /** Parses a resume PDF into structured profile data using OpenAI */
  async parseResume(pdfBuffer: Buffer): Promise<ParsedResume> {
    const text = await this.extractTextFromPdf(pdfBuffer);

    if (!text || text.trim().length < 50) {
      throw ApiError.badRequest('Could not extract meaningful text from the PDF');
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a resume parser. Extract structured data from the resume text and return a JSON object with these fields:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "skills": ["array of skill strings"],
  "experience": [{"title": "Job Title", "company": "Company Name", "location": "City, State", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "current": boolean, "description": "brief description"}],
  "education": [{"institution": "University Name", "degree": "Degree Type", "fieldOfStudy": "Major/Field", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "current": boolean}],
  "bio": "A brief 1-2 sentence professional summary",
  "headline": "A short professional headline (e.g., 'Senior React Developer with 5 years experience')"
}
Return ONLY valid JSON. If a field cannot be determined, use null for strings or empty array for arrays.`,
        },
        {
          role: 'user',
          content: `Parse this resume:\n\n${text.slice(0, 6000)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw ApiError.internal('AI failed to parse the resume');
    }

    try {
      const parsed = JSON.parse(content) as ParsedResume;
      return {
        ...parsed,
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
      };
    } catch {
      throw ApiError.internal('Failed to parse AI response');
    }
  }

  /** Generates a professional job description based on title, skills, and requirements */
  async generateJobDescription(data: {
    title: string;
    skills: string[];
    experienceLevel: string;
    jobType: string;
    workMode: string;
    location: string;
    salaryMin?: number;
    salaryMax?: number;
    companyDescription?: string;
  }): Promise<string> {
    const prompt = `Generate a professional job description for the following role:

Title: ${data.title}
Required Skills: ${data.skills.join(', ')}
Experience Level: ${data.experienceLevel}
Job Type: ${data.jobType}
Work Mode: ${data.workMode}
Location: ${data.location}
${data.salaryMin ? `Salary Range: ₹${data.salaryMin.toLocaleString()} - ₹${data.salaryMax?.toLocaleString() || 'negotiable'}` : ''}
${data.companyDescription ? `About the Company: ${data.companyDescription}` : ''}

Write a compelling job description that includes:
1. A brief about the role (2-3 sentences)
2. Key responsibilities (5-7 bullet points)
3. Requirements (5-7 bullet points)
4. Nice-to-have qualifications (3-4 bullet points)
5. What we offer / perks (4-5 bullet points)

Keep it professional, concise, and engaging. Do NOT include salary information in the description itself.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR copywriter who writes compelling job descriptions for tech companies in India.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw ApiError.internal('AI failed to generate job description');
    }

    return content;
  }

  /** Generates a personalized cover letter based on employee profile and job details */
  async generateCoverLetter(employeeId: string, jobId: string): Promise<string> {
    const [employee, job] = await Promise.all([
      Employee.findById(employeeId),
      Job.findById(jobId).populate('company', 'name industry'),
    ]);

    if (!employee) {
      throw ApiError.notFound('Employee profile not found');
    }

    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const companyName = (job.company as any)?.name || 'the company';

    const prompt = `Write a professional cover letter for this job application:

APPLICANT PROFILE:
- Name: ${employee.firstName} ${employee.lastName}
- Headline: ${employee.headline || 'Professional'}
- Skills: ${employee.skills?.join(', ') || 'Not specified'}
- Experience: ${employee.experience?.map(e => `${e.title} at ${e.company} (${e.current ? 'current' : 'past'})`).join('; ') || 'Not specified'}
- Education: ${employee.education?.map(e => `${e.degree} in ${e.fieldOfStudy} from ${e.institution}`).join('; ') || 'Not specified'}
- Bio: ${employee.bio || ''}

JOB DETAILS:
- Title: ${job.title}
- Company: ${companyName}
- Description: ${job.description.slice(0, 1500)}
- Required Skills: ${job.skillsRequired.join(', ')}
- Experience Level: ${job.experienceLevel}

Write a concise, personalized cover letter (250-350 words) that:
1. Opens with enthusiasm for the specific role
2. Highlights 2-3 relevant experiences/skills that match the job requirements
3. Shows knowledge of the company
4. Ends with a strong call to action

Keep it professional but personable. Don't be generic.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach who writes compelling, personalized cover letters.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw ApiError.internal('AI failed to generate cover letter');
    }

    return content;
  }

  /** Calculates a match score between an employee and a job based on skills, experience, location, and salary */
  calculateMatchScore(employee: IEmployee, job: IJob): MatchScore {
    const weights = {
      skills: 40,
      experience: 30,
      location: 15,
      salary: 15,
    };

    // --- Skills Match (0-100) ---
    const employeeSkills = (employee.skills || []).map(s => s.toLowerCase().trim());
    const requiredSkills = (job.skillsRequired || []).map(s => s.toLowerCase().trim());

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const required of requiredSkills) {
      const found = employeeSkills.some(
        s => s === required || s.includes(required) || required.includes(s)
      );
      if (found) {
        matchedSkills.push(required);
      } else {
        missingSkills.push(required);
      }
    }

    const skillScore = requiredSkills.length > 0
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : 50;

    // --- Experience Level Match (0-100) ---
    const levels = ['entry', 'mid', 'senior', 'lead', 'executive'];
    const jobLevelIndex = levels.indexOf(job.experienceLevel);

    // Estimate employee level from years of experience
    let employeeYears = 0;
    if (employee.experience && employee.experience.length > 0) {
      const earliest = employee.experience.reduce((min, exp) => {
        const start = new Date(exp.startDate).getTime();
        return start < min ? start : min;
      }, Date.now());
      employeeYears = Math.round((Date.now() - earliest) / (365.25 * 24 * 60 * 60 * 1000));
    }

    let estimatedLevel: number;
    if (employeeYears <= 1) estimatedLevel = 0;       // entry
    else if (employeeYears <= 3) estimatedLevel = 1;  // mid
    else if (employeeYears <= 6) estimatedLevel = 2;  // senior
    else if (employeeYears <= 10) estimatedLevel = 3; // lead
    else estimatedLevel = 4;                          // executive

    const levelDiff = Math.abs(jobLevelIndex - estimatedLevel);
    const experienceScore = levelDiff === 0 ? 100 : levelDiff === 1 ? 70 : levelDiff === 2 ? 40 : 10;

    // --- Location Match (0-100) ---
    let locationScore = 50; // default neutral
    if (job.workMode === 'remote') {
      locationScore = 100; // remote jobs match everyone
    } else if (employee.location && job.location) {
      const empLoc = employee.location.toLowerCase();
      const jobLoc = job.location.toLowerCase();
      if (empLoc.includes(jobLoc) || jobLoc.includes(empLoc)) {
        locationScore = 100;
      } else {
        locationScore = 30;
      }
    }

    // Check work mode preference
    if (employee.preferredWorkMode && employee.preferredWorkMode.length > 0) {
      if (employee.preferredWorkMode.includes(job.workMode)) {
        locationScore = Math.min(locationScore + 20, 100);
      } else {
        locationScore = Math.max(locationScore - 20, 0);
      }
    }

    // --- Salary Match (0-100) ---
    let salaryScore = 50; // default neutral if no data
    if (employee.expectedSalary && job.salaryMax) {
      if (employee.expectedSalary <= job.salaryMax) {
        salaryScore = 100;
      } else if (job.salaryMin && employee.expectedSalary >= job.salaryMin) {
        salaryScore = 80;
      } else {
        // How far off is it?
        const diff = employee.expectedSalary - job.salaryMax;
        const percentOff = diff / job.salaryMax;
        salaryScore = Math.max(0, Math.round(50 - percentOff * 100));
      }
    }

    // --- Overall Score ---
    const overall = Math.round(
      (skillScore * weights.skills +
        experienceScore * weights.experience +
        locationScore * weights.location +
        salaryScore * weights.salary) / 100
    );

    // Generate summary
    let summary = '';
    if (overall >= 80) summary = 'Excellent match — strong alignment across skills, experience, and preferences.';
    else if (overall >= 60) summary = 'Good match — meets most requirements with minor gaps.';
    else if (overall >= 40) summary = 'Moderate match — some relevant skills but notable gaps exist.';
    else summary = 'Low match — significant gaps in required skills or experience level.';

    return {
      overall,
      breakdown: {
        skills: skillScore,
        experience: experienceScore,
        location: locationScore,
        salary: salaryScore,
      },
      matchedSkills,
      missingSkills,
      summary,
    };
  }

  /** Generates a brief 1-2 sentence explanation of why a job matches an employee */
  generateMatchExplanation(employee: IEmployee, job: IJob, matchScore: MatchScore): string {
    const parts: string[] = [];

    if (matchScore.matchedSkills.length > 0) {
      const top3 = matchScore.matchedSkills.slice(0, 3);
      parts.push(`Your skills in ${top3.join(', ')} directly match this role's requirements`);
    }

    if (matchScore.breakdown.experience >= 70) {
      parts.push(`your experience level aligns well with what they're looking for`);
    }

    if (matchScore.breakdown.location >= 80) {
      parts.push(`the location/work mode fits your preferences`);
    }

    if (matchScore.breakdown.salary >= 80) {
      parts.push(`the salary range matches your expectations`);
    }

    if (parts.length === 0) {
      return `This role has some overlap with your background. Consider reviewing the requirements to see if it's a good fit.`;
    }

    const explanation = parts.length === 1
      ? `${parts[0]}.`
      : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;

    return explanation.charAt(0).toUpperCase() + explanation.slice(1);
  }
}

export default new AIService();
