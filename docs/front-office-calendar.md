# Front Office onboarding and calendar

Front Office path selection is scoped to the authenticated user and Front Office save ID in
`user_front_office_saves`. The same save also stores its independently advancing simulation phase.
Anonymous sessions use a save-scoped local-storage fallback.

Existing saves are inferred as `full` only when the browser already contains clear simulation
progress: a phase beyond the untouched `resign_cut` default, Full Experience mode, or completed
offseason steps. Untouched saves continue to show onboarding.

`getNFLCalendarState()` is the canonical real-world phase source. It consumes ESPN's explicit NFL
season type and week metadata, uses Eastern Time for calendar dates, and supports Week 18 plus all
postseason rounds. New Full Experience saves initialize from this value once; later page loads use
the stored simulation phase and never reset progress to the real-world date.

The 2026 free-agency and draft boundaries come from the NFL's published important-dates calendar.
Outside configured offseason events and actual schedule windows, the safe fallback is Offseason.
