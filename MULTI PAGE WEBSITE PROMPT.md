MULTI PAGE WEBSITE PROMPT 



PROMPT 1

I want you to act as a Senior Product Manager, Senior UI/UX Designer, Senior Frontend Engineer, Senior Backend Engineer, and Civic Technology Consultant.



I'm a beginner in full stack development and I want you to help me design and build a professional but realistic MVP (Minimum Viable Product) for a web-based public opinion polling platform focused on measuring United states of Africa' opinions about government performance and public issues.



United states of Arica is an imaginary country, a replica of the united states of America located in west Africa meant to be a beacon of light and hope. The geographical area is inhabited principally by people of about 450 tribes in 40 states. Rooted in the historical struggle for independence, justice, and equitable governance, the concept is born out of decades of systemic marginalization, economic disenfranchisement, and cultural suppression offering hope for a future where every citizen can thrive in dignity and freedom. The United States of Africa reflects the ambition to create a unified, self-governing nation, drawing inspiration from democratic principles and the desire for political and economic freedom. The people have long sought a government representing their interests and respecting their unique cultural, linguistic, and historical heritage.



This project is intended for my full-stack developer portfolio, so I want it to resemble the professionalism and credibility of polling organizations such as YouGov and Pew Research Center while remaining realistic enough for a solo developer to build.



PROJECT OVERVIEW



The platform will allow citizens to:



Participate in opinion polls

Rate the performance of public leaders

Share opinions on major national issues

View poll results and trends

Understand polling methodology



This platform is not an election platform and not a voting platform.



It is strictly a public opinion and civic engagement platform.



The goal is to collect and visualize public sentiment regarding leadership performance and national issues.



PROJECT NAME



Suggest 5–10 professional project names that communicate trust, transparency, and civic participation.



Examples:



CivicMeter 

PublicVoice 

OpinionTrack 





TARGET USERS



Define:



Primary users

Secondary users

User personas

User goals

User frustrations

Expected user journeys

MVP SCOPE



The MVP should contain approximately 8 main pages plus an admin dashboard.



REQUIRED PAGES



Design and document the following pages in detail:



1\. Home Page



Include:



Hero Section

Headline

Supporting text

CTA buttons

Featured Statistics



Examples:



Presidential approval rating

Most important national issue

Number of active polls

Total responses

Featured Polls

How It Works Section

Why Participate Section

Testimonials Section (optional)

Footer



2\. Polls Page



Display:



Active polls

Poll categories

Search functionality

Filter functionality



Example categories:



Presidency

Governors

Economy

Security

Education

Healthcare



3\. Single Poll Page



Design a complete polling experience.



Include:



Poll Header

Progress Indicator

Questions



Examples:



Presidential approval rating

Economy rating

Security rating

Education rating

Healthcare rating



Response options:



Strongly Approve

Approve

Neutral

Disapprove

Strongly Disapprove

Demographic Questions



Examples:



Age range

Gender

State

Occupation

Education level

Submit Button

Thank You Screen



4\. Results Page



Design a professional analytics dashboard.



Include:



Approval Ratings

Charts

Pie chart

Bar chart

Line chart

Demographic Breakdown

State-Based Breakdown

Trend Analysis



5\. Methodology Page



Explain:



What polling is

How polling works

Sample collection

Data weighting

Margin of error

Poll limitations



Include trust-building elements.



6\. About Page



Include:



Mission

Vision

Values

Platform goals

Team section

FAQ





7\. Login/Register



Design:



Login Page

Registration Page



Include:



Validation

Error states

Success states





8\. User Dashboard



Allow users to:



View profile

View participation history

Manage account settings

ADMIN SECTION



Design an admin system containing:



Admin Dashboard



Features:



Total users

Total polls

Active polls

Poll participation statistics

Poll Management



Admin should be able to:



Create polls

Edit polls

Delete polls

Open polls

Close polls

User Management



Admin should be able to:



View users

Suspend users

Manage permissions

DATABASE DESIGN



Design a complete database architecture.



Include:



Users Collection/Table



Fields:



id

fullName

email

password

state

ageRange

role

Polls Collection/Table



Fields:



id

title

description

category

status

createdAt

Questions Collection/Table



Fields:



id

pollId

questionText

questionType

Responses Collection/Table



Fields:



id

userId

pollId

questionId

answer

submittedAt



Explain all relationships.



Provide an ERD (Entity Relationship Diagram) description.



SYSTEM FEATURES



Recommend MVP features and future features.



MVP Features



Examples:



User registration

Login

Poll participation

Poll results

Admin dashboard

Future Features



Examples:



Real-time updates

Poll trend forecasting

Geographic heatmaps

Poll comparison tools

Mobile app

UI/UX DESIGN SYSTEM



Create a complete design system.



Include:



Color Palette



Professional and trustworthy



Typography

Spacing System

Components



Examples:



Buttons

Cards

Forms

Charts

Tables

Navigation





RESPONSIVE DESIGN



Provide layouts for:



Mobile

Tablet

Desktop



Use a mobile-first approach.



FRONTEND ARCHITECTURE



Recommend:



HTML5

CSS3

JavaScript



Then provide a React version recommendation.



Explain:



Folder structure

Component structure

Routing structure

BACKEND ARCHITECTURE



Recommend:



Node.js

Express.js



Design:



Folder structure

Controllers

Services

Middleware

Authentication flow

DATABASE



Recommend either:



MongoDB

or

PostgreSQL



Explain why.



AUTHENTICATION



Design:



Registration flow

Login flow

JWT authentication

Password hashing

Role-based access control

API DESIGN



Provide REST API endpoints.



Examples:



Auth

POST /api/auth/register

POST /api/auth/login



Polls

GET /api/polls

GET /api/polls/:id

POST /api/polls



Responses

POST /api/responses



Analytics

GET /api/results



Document request and response examples.



CHARTS AND ANALYTICS

Recommend:

Chart.js



Show how approval ratings should be visualized.



Include:

Pie chart

Bar chart

Trend chart



SECURITY

Recommend:



Rate limiting

Input validation

Password hashing

JWT protection

CSRF considerations

Data privacy measures





DEPLOYMENT

Recommend:

Frontend

Vercel



Backend

Render



Database

MongoDB Atlas



Explain deployment workflow.



DEVELOPMENT ROADMAP

Break development into phases:



Phase 1

Frontend UI



Phase 2

Backend APIs



Phase 3

Database integration



Phase 4

Authentication



Phase 5

Analytics



Phase 6

Deployment



Provide estimated timelines.



DELIVERABLE FORMAT

I want the response structured like a real product specification document containing:



Executive Summary

Product Vision

User Personas

Feature Requirements

Information Architecture

Sitemap

Wireframe Descriptions

Database Design

API Design

UI Design System

Technical Architecture

Security Considerations

Deployment Plan

Development Roadmap

Future Enhancements



Let start with phase 1-the frontend UI and there, let's only focus on the home page for today.



**PROMPT 2**

You've done an excellent job, Thank you. Now compile the landing page into a downloadable HTML and CSS files using VS code as IDE



**PROMPT 3**

Let's now move to phase 1 page 2



**PROMPT 3**

Excellent. Let's now move to Page 3 — the Single Poll page. Remember that you do not need to regenerate the previous page codes. Only the new codes should be generated and tell me where/how to append it to the previous ones.



**PROMPT 4**

Now complete the last task you started which is the single poll page. Remember to not repeat what has been done already



**PROMPT 5**

I am now ready to move to page 4 - the Result page



**PROMPT 6**

Now complete the last task you started which is the result page. Remember to not repeat what has been done already



**PROMPT 7**

Everything looks fine. We can now proceed to the methodology page



**PROMPT 8**

Let's now move on to the next page which is about page



**PROMPT 9**

This project is a work in progress, one that am very proud of and intend and intend to continue later. For now, generate a README.md file to add to the repo

