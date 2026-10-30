# Tableau Analytics Build Guide — PitchsideIQ

This guide provides worksheet-by-worksheet instructions to build, publish, and embed the 7 PitchsideIQ Tableau dashboards using Tableau Desktop / Tableau Public and the Next.js frontend embedding component.

---

## 1. Overview & Data Pipeline

PitchsideIQ generates 7 dedicated, denormalized CSV extracts designed specifically for Tableau Public.

### Generating the Extracts
Run the export script from the `backend` directory:
```bash
python -m scripts.export_tableau_data --out ../data/tableau
```

This creates the following extracts in `data/tableau/`:
1. `tableau_overview.csv` — Macro league and season aggregate metrics
2. `tableau_standings.csv` — Full league tables with positions, points, goal difference, and form
3. `tableau_fixtures_results.csv` — Match-level results, historical odds, implied probabilities, and Elo ratings
4. `tableau_match_stats.csv` — Granular match metrics (shots, on-target, corners, fouls, cards, possession)
5. `tableau_team_performance.csv` — Team home vs. away records, win rates, and scoring averages
6. `tableau_player_stats.csv` — Player appearances, goals, assists, and minutes per goal
7. `tableau_important_matches.csv` — Marquee matchups, derbies, upsets, and high-scoring thrillers

---

## 2. Calculated Fields Reference

Create these calculated fields in Tableau to power the visualizations:

| Field Name | Formula | Purpose |
|---|---|---|
| **Points Per Match (PPM)** | `[points] / [played]` | Normalized team efficiency |
| **Goal Difference (GD)** | `[goals_for] - [goals_against]` | Goal differential |
| **Home Advantage Ratio** | `[avg_home_goals] / ([avg_home_goals] + [avg_away_goals])` | Measure home goal skew |
| **Over 2.5 Goals Flag** | `IF [total_goals] > 2.5 THEN "Over 2.5" ELSE "Under 2.5" END` | Goal market distribution |
| **Elo Gap Category** | `IF ABS([elo_diff]) > 150 THEN "Lopsided" ELSEIF ABS([elo_diff]) > 75 THEN "Moderate" ELSE "Even" END` | Match disparity |
| **Win Rate %** | `([total_won] / [total_played]) * 100` | Overall team win rate |
| **Bookmaker Margin %** | `(([implied_prob_home] + [implied_prob_draw] + [implied_prob_away]) - 1.0) * 100` | Bookmaker overround |

---

## 3. Dashboard-by-Dashboard Worksheet Build Guide

---

### Dashboard 1: League Overview (`Overview`)
*Target audience: Executive and fan overview of competitions.*

#### Worksheet 1.1: KPI Summary Cards
- **Type**: Text / KPI Card
- **Measures**:
  - `SUM([total_matches])`
  - `SUM([total_goals])`
  - `AVG([avg_goals_per_match])`
  - `COUNTD([league_code])`
- **Marks**: Text label formatted with large bold numbers.
- **Filters**: `season_label` (Single value dropdown, default to latest).

#### Worksheet 1.2: Goals per Match by League
- **Columns**: `AVG([avg_goals_per_match])`
- **Rows**: `[league_name]` (Sort descending by `avg_goals_per_match`)
- **Marks**: Bar chart. Color by `AVG([avg_goals_per_match])` with diverging palette (Blue-Green).
- **Tooltips**: Include `total_matches` and `total_goals`.

#### Worksheet 1.3: Home vs Away Scoring Distribution
- **Columns**: `[season_label]`
- **Rows**: Measure Values (`AVG([avg_home_goals])`, `AVG([avg_away_goals])`)
- **Marks**: Dual line chart or side-by-side bar chart. Blue for Home, Orange for Away.

#### Worksheet 1.4: League Hierarchy & Scale
- **Marks**: Treemap. Size by `SUM([total_matches])`, Color by `[country]`. Label with `league_name` and `total_matches`.

---

### Dashboard 2: Standings & Form Tracker (`Standings`)
*Target audience: League tables with dynamic form analysis.*

#### Worksheet 2.1: League Standings Table
- **Rows**: `[position]`, `[team]`
- **Columns / Text Measures**: `[played]`, `[won]`, `[drawn]`, `[lost]`, `[goals_for]`, `[goals_against]`, `[goal_difference]`, `[points]`, `[points_per_match]`
- **Marks**: Text table. Sort rows by `[position]` ascending.
- **Filters**:
  - `league_code` (Single Value Dropdown)
  - `season` (Single Value Dropdown)

#### Worksheet 2.2: Form Guide (Last 5 Matches)
- **Rows**: `[position]`, `[team]`
- **Columns**: `[form]`
- **Marks**: Gantt / Square. Color code recent results (Green for W, Gray for D, Red for L).

#### Worksheet 2.3: Points vs Goal Difference Quadrant
- **Columns**: `[goal_difference]` (with zero reference line)
- **Rows**: `[points]` (with average reference line)
- **Marks**: Circle / Scatter plot. Detail: `[team]`. Color by `[position]`.

---

### Dashboard 3: Fixtures, Results & Market Odds (`Fixtures_Results`)
*Target audience: Pre-match evaluation, odds analysis, and outcomes.*

#### Worksheet 3.1: Outcome Probability vs Realized Result
- **Columns**: `[implied_prob_home]`
- **Rows**: `[implied_prob_away]`
- **Marks**: Shape/Circle. Shape by `[result]` (H = Blue circle, D = Gray diamond, A = Amber square).
- **Filters**: `league_code`, `season`, `match_date` (Date range slider).

#### Worksheet 3.2: Bookmaker Overround & Margin Distribution
- **Columns**: `[Bookmaker Margin %]` (binned into 1% bins)
- **Rows**: `COUNT([match_id])`
- **Marks**: Histogram. Highlights efficiency across top leagues vs lower tiers.

#### Worksheet 3.3: Elo Difference vs Match Outcome
- **Columns**: `[elo_diff]` (binned into 50-point increments)
- **Rows**: `COUNT([match_id])`
- **Color**: `[result]` (100% Stacked Bar chart). Shows how often higher Elo teams win.

---

### Dashboard 4: Match In-Depth Statistics (`Match_Stats`)
*Target audience: Deep matchday performance metrics.*

#### Worksheet 4.1: Shots vs Shots on Target Ratio
- **Columns**: `[home_shots]`, `[away_shots]`
- **Rows**: `[home_shots_on_target]`, `[away_shots_on_target]`
- **Marks**: Scatter plot with 45-degree reference line (accuracy benchmark).

#### Worksheet 4.2: Disciplinary Action & Fouls
- **Columns**: `[league_name]`
- **Rows**: `AVG([home_yellow] + [away_yellow])`, `AVG([home_red] + [away_red])`
- **Marks**: Dual Axis Bar chart. Yellow cards on left axis, Red cards on right axis.

#### Worksheet 4.3: Corner Dominance vs Match Result
- **Columns**: `[home_corners] - [away_corners]`
- **Rows**: `[result]`
- **Marks**: Box and whisker plot showing corner advantage across results.

---

### Dashboard 5: Team Performance Profile (`Team_Performance`)
*Target audience: Head-to-head scouting and tactical splits.*

#### Worksheet 5.1: Home vs Away Performance Split
- **Rows**: `[team]`
- **Columns**: Measure Values (`[home_win_rate_pct]`, `[away_win_rate_pct]`)
- **Marks**: Side-by-side horizontal bar chart. Sorted by `[overall_win_rate_pct]`.
- **Filters**: `league_code` (Single value dropdown), `season` (Single value dropdown).

#### Worksheet 5.2: Attack vs Defense Matrix
- **Columns**: `[total_gf] / [total_played]` (Goals Scored per Match)
- **Rows**: `[total_ga] / [total_played]` (Goals Conceded per Match, reversed axis)
- **Marks**: Scatter plot. 4 quadrants: "High Octane", "Solid Defense", "Struggling", "Elite".

---

### Dashboard 6: Player Intelligence & Top Scorers (`Player_Stats`)
*Target audience: Individual player output and efficiency.*

#### Worksheet 6.1: Golden Boot Race (Top Scorers)
- **Rows**: `[player_name]` (Top 20 filtered by `SUM([goals])`)
- **Columns**: `[goals]`
- **Marks**: Horizontal Bar chart. Label with `[goals]` and `[team]`.
- **Filters**: `league_code`, `season`.

#### Worksheet 6.2: Minutes per Goal Efficiency
- **Columns**: `[minutes]`
- **Rows**: `[mins_per_goal]`
- **Marks**: Bubble / Circle. Size by `[goals]`, Color by `[position]`. Minimum 5 goals threshold.

#### Worksheet 6.3: Goal Contributions (Goals + Assists)
- **Rows**: `[player_name]`
- **Columns**: `[goals]`, `[assists]` (Stacked Bar).

---

### Dashboard 7: Marquee & Important Matches (`Important_Matches`)
*Target audience: Rivalries, upsets, and must-watch games.*

#### Worksheet 7.1: Marquee Match Explorer
- **Columns / Rows**: Match Date, Home Team, Away Team, Score, Combined Elo, Match Category.
- **Filters**: `match_category` (Multiple values: 'Elite Clash', 'Major Upset', 'High-Scoring Thriller', 'Tight Derby').

#### Worksheet 7.2: Giant Killers (Major Upsets)
- **Columns**: `[match_date]`
- **Rows**: `MAX([odd_home], [odd_away])` (Winner's pre-match odds)
- **Marks**: Scatter plot with winner name and odds label (e.g., odds 8.50+).

---

## 4. Publishing to Tableau Public

1. In Tableau Desktop, connect to each CSV extract or combine them into a single workbook.
2. Build the 7 dashboards with fixed dimensions of **1200 x 800 px** or **Automatic Responsive**.
3. Set Dashboard Actions:
   - Go to **Dashboard > Actions > Add Action > Filter**.
   - Set Source Sheet as `Standings Table` and Target Sheet as `Team Performance`.
4. Click **Server > Tableau Public > Save to Tableau Public As...**.
5. Log in with your free Tableau Public credentials.
6. Once published, click the **Share** button on Tableau Public and copy the Viz Link (e.g. `https://public.tableau.com/views/PitchsideIQAnalytics/Overview`).

---

## 5. Wiring into Next.js & Filter Sync

### Configuration
Add your published URL to `.env.local`:
```bash
NEXT_PUBLIC_TABLEAU_VIZ_URL=https://public.tableau.com/views/PitchsideIQAnalytics/Overview
```

### Embedding Component (`TableauEmbed.tsx`)
The frontend uses the Tableau Embedding API v3:
```tsx
<TableauEmbed
  src={process.env.NEXT_PUBLIC_TABLEAU_VIZ_URL}
  filters={{
    league_code: selectedLeague,
    season: selectedSeason,
  }}
/>
```

When a user selects a league or season in the PitchsideIQ navigation, `<viz-filter>` tags dynamically synchronize the Tableau worksheets without reloading the iframe.

