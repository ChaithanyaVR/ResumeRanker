"use client";
import React, { useMemo } from "react";

function cleanTextBlock(text = "") {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseStructuredContent(content) {
  if (!content) return null;
  if (typeof content === "object" && !content.text) return content;

  const rawText = cleanTextBlock(content?.text || "");
  if (!rawText) return null;

  const tryParse = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const direct = tryParse(rawText);
  if (direct) return direct;

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return tryParse(rawText.slice(start, end + 1));
  }

  return null;
}

function formatValue(value) {
  if (value == null || value === "") return "Not available";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function splitLines(text = "") {
  return cleanTextBlock(text)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function extractScoreFromText(text = "") {
  const match = text.match(/"score"\s*:\s*(\d+)|score\s*[:=-]?\s*(\d+)/i);
  return match ? Number(match[1] || match[2]) : null;
}

function extractArrayFromJsonLikeText(text = "", key) {
  const regex = new RegExp(`"${key}"\\s*:\\s*\\[(.*?)\\]`, "is");
  const match = text.match(regex);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.replace(/["\n\r]/g, "").trim())
    .filter(Boolean);
}

function extractFieldFromJsonLikeText(text = "", key) {
  const regex = new RegExp(`"${key}"\\s*:\\s*"(.*?)"`, "is");
  const match = text.match(regex);
  return match ? match[1].replace(/\\"/g, '"').trim() : "";
}

function SectionTitle({ children }) {
  return (
    <p className="mb-2 text-sm font-semibold text-amber-300">{children}</p>
  );
}

function BulletList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-2 text-sm text-slate-200">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
          <span>{formatValue(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function ChipList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={idx}
          className="rounded-full border border-slate-600 bg-slate-700/70 px-3 py-1 text-xs text-slate-100"
        >
          {formatValue(item)}
        </span>
      ))}
    </div>
  );
}

function ProjectCards({ projects }) {
  if (!Array.isArray(projects) || projects.length === 0) return null;

  return (
    <div className="grid gap-3">
      {projects.map((project, idx) => {
        if (typeof project === "string" || typeof project === "number") {
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-700 bg-slate-800/70 p-4"
            >
              <p className="text-sm leading-6 text-slate-200">{project}</p>
            </div>
          );
        }

        if (typeof project !== "object" || project === null) {
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-700 bg-slate-800/70 p-4"
            >
              <p className="text-sm leading-6 text-slate-200">
                {formatValue(project)}
              </p>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="rounded-xl border border-slate-700 bg-slate-800/70 p-4"
          >
            <p className="font-medium text-white">
              {project.project_name || project.name || "Untitled Project"}
            </p>

            {project.description && (
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {project.description}
              </p>
            )}

            {project.technologies_used && (
              <div className="mt-3">
                <SectionTitle>Technologies</SectionTitle>
                <ChipList
                  items={
                    Array.isArray(project.technologies_used)
                      ? project.technologies_used
                      : [project.technologies_used]
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreCard({ parsed, rawText }) {
  const score = parsed?.score ?? extractScoreFromText(rawText);
  const strengths = parsed?.strengths?.length
    ? parsed.strengths
    : extractArrayFromJsonLikeText(rawText, "strengths");
  const gaps = parsed?.gaps?.length
    ? parsed.gaps
    : extractArrayFromJsonLikeText(rawText, "gaps");
  const summary =
    parsed?.summary || extractFieldFromJsonLikeText(rawText, "summary") || rawText;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 min-h-16 min-w-16 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-bold leading-none text-slate-900 aspect-square">
          {score ?? "NA"}
        </div>

        <div>
          <p className="text-sm font-semibold text-amber-300">
            Overall Match Score
          </p>
          <p className="text-sm text-slate-300">
            {summary || "Summary not available."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 p-4">
          <SectionTitle>Strengths</SectionTitle>
          {strengths.length > 0 ? (
            <BulletList items={strengths} />
          ) : (
            <p className="text-sm text-slate-300">No strengths extracted.</p>
          )}
        </div>

        <div className="rounded-xl border border-rose-600/30 bg-rose-500/10 p-4">
          <SectionTitle>Gaps</SectionTitle>
          {gaps.length > 0 ? (
            <BulletList items={gaps} />
          ) : (
            <p className="text-sm text-slate-300">No gaps extracted.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EducationCard({ education }) {
  if (!education || typeof education !== "object") {
    return (
      <p className="text-sm text-slate-200">{formatValue(education)}</p>
    );
  }

  const institutions = Array.isArray(education.institutions)
    ? education.institutions
    : [];
  const degrees = Array.isArray(education.degrees) ? education.degrees : [];
  const dates = Array.isArray(education.dates) ? education.dates : [];
  const name = typeof education.name === "string" ? education.name.trim() : "";

  const hasAny =
    Boolean(name) ||
    institutions.length > 0 ||
    degrees.length > 0 ||
    dates.length > 0;

  if (!hasAny) {
    return (
      <p className="text-sm text-slate-300">No education details available.</p>
    );
  }

  return (
    <div className="space-y-3 text-sm text-slate-200">
      {name && <p className="font-medium text-white">{name}</p>}

      {institutions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Institutions
          </p>
          <BulletList items={institutions} />
        </div>
      )}

      {degrees.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Degrees
          </p>
          <BulletList items={degrees} />
        </div>
      )}

      {dates.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Dates
          </p>
          <BulletList items={dates} />
        </div>
      )}
    </div>
  );
}

function ExtractionCard({ parsed, rawText }) {
  const fallbackLines = splitLines(rawText);
  const skills = Array.isArray(parsed?.skills) ? parsed.skills : [];
  const projects = Array.isArray(parsed?.relevant_projects)
    ? parsed.relevant_projects
    : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Experience</SectionTitle>
          <p className="text-sm text-slate-200">
            {parsed?.experience_years == null
              ? "Could not be determined confidently from the resume."
              : `${parsed.experience_years} years`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Education</SectionTitle>
          <EducationCard education={parsed?.education} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
        <SectionTitle>Skills</SectionTitle>
        {skills.length > 0 ? (
          <ChipList items={skills} />
        ) : (
          <p className="text-sm text-slate-300">No skills extracted.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
        <SectionTitle>Relevant Projects</SectionTitle>
        {projects.length > 0 ? (
          <ProjectCards projects={projects} />
        ) : fallbackLines.length > 0 ? (
          <BulletList items={fallbackLines} />
        ) : (
          <p className="text-sm text-slate-300">
            No project details available.
          </p>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({ parsed, rawText }) {
  const fallbackLines = splitLines(rawText);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Missing Skills</SectionTitle>
          <BulletList items={parsed?.missing_skills || []} />
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Resume Improvements</SectionTitle>
          <BulletList items={parsed?.resume_improvements || []} />
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Project Suggestions</SectionTitle>
          <BulletList items={parsed?.project_suggestions || []} />
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Learning Recommendations</SectionTitle>
          <BulletList items={parsed?.learning_recommendations || []} />
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <SectionTitle>Overall Advice</SectionTitle>
        <p className="text-sm leading-6 text-slate-200">
          {parsed?.overall_advice ||
            (fallbackLines[0] ?? "No advice available.")}
        </p>
      </div>

      {!parsed && fallbackLines.length > 1 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
          <SectionTitle>Additional Suggestions</SectionTitle>
          <BulletList items={fallbackLines.slice(1)} />
        </div>
      )}
    </div>
  );
}

function ExplanationCard({ rawText }) {
  const paragraphs = splitLines(rawText);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-5">
      <SectionTitle>Fit Summary</SectionTitle>
      <div className="space-y-3 text-sm leading-7 text-slate-200">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
        ) : (
          <p>No explanation available.</p>
        )}
      </div>
    </div>
  );
}

function ResponseBody({ type, parsed, rawText }) {
  if (type === "scoring") {
    return <ScoreCard parsed={parsed} rawText={rawText} />;
  }

  if (type === "extraction") {
    return <ExtractionCard parsed={parsed} rawText={rawText} />;
  }

  if (type === "suggestion") {
    return <SuggestionCard parsed={parsed} rawText={rawText} />;
  }

  return <ExplanationCard rawText={rawText} />;
}

export default function GeminiResponses({ results = [], promptType }) {
  const normalizedResults = useMemo(
    () =>
      (Array.isArray(results) ? results : []).map((res) => ({
        ...res,
        parsed: parseStructuredContent(res.result),
        rawText: cleanTextBlock(res.result?.text || ""),
      })),
    [results],
  );

  if (normalizedResults.length === 0) {
    return (
      <div className="mx-auto mt-8 max-w-7xl">
        <p className="text-sm italic text-slate-400">
          No {promptType} results available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-7xl space-y-5">
      <div className="rounded-2xl bg-[#1e293b] p-6 shadow-lg">
        <h3 className="text-2xl font-semibold capitalize text-amber-300">
          {promptType} Results
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Structured output for easier review.
        </p>
      </div>

      {normalizedResults.map((res, index) => (
        <div
          key={`${res.resume_id}-${index}`}
          className="rounded-2xl border border-slate-700 bg-[#1e293b] p-6 shadow-lg"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">
                Resume ID: {res.resume_id}
              </p>
            </div>

            <span className="w-fit rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-300">
              {res.prompt_type}
            </span>
          </div>

          <ResponseBody
            type={res.prompt_type}
            parsed={res.parsed}
            rawText={res.rawText}
          />
        </div>
      ))}
    </div>
  );
}
