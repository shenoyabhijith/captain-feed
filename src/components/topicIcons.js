import {
  Bot, FlaskConical, SquareTerminal, Cpu, Code2, Wrench, Flag, Target, ShieldCheck,
  DollarSign, TrendingUp, TrendingDown, Newspaper, Users, MessageSquare, Brain, Gauge,
  Layers, Search, Rocket, Eye, BookOpen, Calendar, Scale, Sparkles, Zap, Workflow,
  GitPullRequest, Image, Clock, Lock, Lightbulb, UserRound,
} from "lucide-react";

/**
 * Topic → Lucide icon. One icon family app-wide (Lucide, already the app's set).
 * Ordered: first match wins. Returns null when nothing fits, so callers can
 * fall back to a number or a dot instead of a random glyph.
 */
const RULES = [
  [/\b(eval|evals|benchmark|grad(e|ing)|score)\b/i, Gauge],
  [/\b(test|tests|tdd|mutation|property)\b/i, FlaskConical],
  [/\b(cli|terminal|shell|command|help text|ghostty)\b/i, SquareTerminal],
  [/\b(review|pr|pull request|diff)\b/i, GitPullRequest],
  [/\b(skill|skills|tool|tools|setup|config)\b/i, Wrench],
  [/\b(goal|goals|stop|done|finish)\b/i, Flag],
  [/\b(security|injection|safe|risk)\b/i, ShieldCheck],
  [/\b(private|privacy|local)\b/i, Lock],
  [/\b(model|models|haiku|sonnet|opus|gpt|llm|claude|gemini|grok)\b/i, Cpu],
  [/\b(agent|agents|agentic|autonomous|loop)\b/i, Bot],
  [/\b(memory|context|reason|think)\b/i, Brain],
  [/\b(workflow|pipeline|process)\b/i, Workflow],
  [/\b(code|coding|build|ship)\b/i, Code2],
  [/\b(price|cost|fee|fees|token|tokens|\$|deal|save)\b/i, DollarSign],
  [/\b(rally|up|gain|bull|growth)\b/i, TrendingUp],
  [/\b(drop|down|loss|bear|sell-?off)\b/i, TrendingDown],
  [/\b(news|report|launch|announce)\b/i, Newspaper],
  [/\b(people|team|community|builders)\b/i, Users],
  [/\b(debate|pushback|disagree|reply|question)\b/i, MessageSquare],
  [/\b(stack|layer|architecture)\b/i, Layers],
  [/\b(search|research|find)\b/i, Search],
  [/\b(launch|new|release)\b/i, Rocket],
  [/\b(watch|monitor|status)\b/i, Eye],
  [/\b(book|read|reading)\b/i, BookOpen],
  [/\b(date|deadline|schedule|week)\b/i, Calendar],
  [/\b(tax|law|rule|policy)\b/i, Scale],
  [/\b(image|photo|design|ui)\b/i, Image],
  [/\b(time|faster|speed|slow)\b/i, Clock],
  [/\b(idea|tip|try)\b/i, Lightbulb],
  [/\b(ai|personal ai)\b/i, Sparkles],
  [/\b(fast|quick|instant)\b/i, Zap],
];

export function topicIcon(text) {
  const s = String(text || "").replace(/\*\*|`|\[|\]\([^)]*\)/g, "");
  for (const [re, Icon] of RULES) if (re.test(s)) return Icon;
  return null;
}

/**
 * Default when topicIcon() finds nothing, so no bullet falls back to a bare dot:
 * a person glyph when the line opens with a name ("Dax: …", "Simon Willison: …"),
 * else a sparkle.
 */
export function bulletFallbackIcon(text) {
  const s = String(text || "").replace(/\*\*|`/g, "").trim();
  return /^@?[A-Z][\w.'-]*(\s+[A-Z][\w.'-]*){0,3}\s*:/.test(s) ? UserRound : Sparkles;
}
