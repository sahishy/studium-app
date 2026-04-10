function createId(prefix = "id") {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(str) {
	return (str || "")
		.toLowerCase()
		.replace(/[^\w\s/.-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDateToISO(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function startOfDay(date) {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function addDays(date, days) {
	const copy = new Date(date);
	copy.setDate(copy.getDate() + days);
	return copy;
}

function addWeeks(date, weeks) {
	return addDays(date, weeks * 7);
}

function addMonths(date, months) {
	const copy = new Date(date);
	copy.setMonth(copy.getMonth() + months);
	return copy;
}

function getNextWeekday(targetWeekday, now) {
	const today = startOfDay(now);
	const currentWeekday = today.getDay();
	let diff = targetWeekday - currentWeekday;
	if (diff <= 0) diff += 7;
	return addDays(today, diff);
}

function clampConfidence(n) {
	return Math.max(0, Math.min(1, n));
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
	return aStart < bEnd && bStart < aEnd;
}

function extractMatchedSubphrase(match, phrase) {
	const rawFull = match?.[0] || "";
	const rawPhrase = phrase || "";

	if (!rawPhrase) {
		return {
			rawText: rawFull,
			start: match.index,
			end: match.index + rawFull.length,
		};
	}

	const localIndex = rawFull.toLowerCase().indexOf(rawPhrase.toLowerCase());
	const offset = localIndex >= 0 ? localIndex : 0;
	const rawText = rawFull.slice(offset, offset + rawPhrase.length) || rawPhrase;

	return {
		rawText,
		start: match.index + offset,
		end: match.index + offset + rawText.length,
	};
}

function makeTextSegment(text = "") {
	return {
		id: createId("seg"),
		type: "text",
		rawText: text,
		displayText: text,
	};
}

function makeWidgetSegment(match) {
	if (!match) return null;

	const base = {
		id: createId("seg"),
		type: "widget",
		rawText: match.rawText || "",
		displayText: match.rawText || "",
		value: {},
	};

	if (match.kind === "date") {
		return {
			...base,
			widgetType: "date",
			value: {
				dueDate: match?.data?.date || "",
			},
		};
	}

	if (match.kind === "course") {
		return {
			...base,
			widgetType: "course",
			displayText: match.rawText || "",
			value: {
				courseId: match?.data?.courseId || "",
				title: match?.data?.title || "",
				subject: match?.data?.subject || "",
			},
		};
	}

	if (match.kind === "circle") {
		return {
			...base,
			widgetType: "circle",
			displayText: match.rawText || "",
			value: {
				circleId: match?.data?.circleId || "",
				title: match?.data?.title || "",
			},
		};
	}

	if (match.kind === "taskType") {
		return null;
	}

	return null;
}

function isStructuredTitle(value) {
	return Boolean(value && typeof value === "object" && Array.isArray(value.segments));
}

function normalizeTaskTitle(title) {
	if (typeof title === "string") {
		return { segments: [makeTextSegment(title)] };
	}

	if (!isStructuredTitle(title)) {
		return { segments: [makeTextSegment("")] };
	}

	const segments = title.segments
		.filter(Boolean)
		.map((segment) => {
			if (segment.type === "widget") {
				return {
					id: segment.id || createId("seg"),
					type: "widget",
					widgetType: segment.widgetType || "unknown",
					rawText: segment.rawText || "",
					displayText: segment.displayText || segment.rawText || "",
					value: segment.value || {},
				};
			}

			const text = segment.displayText ?? segment.rawText ?? "";
			return {
				id: segment.id || createId("seg"),
				type: "text",
				rawText: text,
				displayText: text,
			};
		});

	return {
		segments: segments.length ? segments : [makeTextSegment("")],
	};
}

function flattenTaskTitle(title) {
	const normalized = normalizeTaskTitle(title);

	return normalized.segments
		.map((segment) => {
			if (segment.type === "text") {
				return segment.displayText ?? segment.rawText ?? "";
			}

			if (segment.displayText) return segment.displayText;
			if (segment.widgetType === "course") return segment.value?.title || "";
			if (segment.widgetType === "circle") return segment.value?.title || "";
			if (segment.widgetType === "date") return segment.value?.dueDate || segment.rawText || "";
			if (segment.widgetType === "taskType") return segment.value?.taskType || "assignment";
			return segment.rawText || "";
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

function extractTaskTitleMetadata(title) {
	const normalized = normalizeTaskTitle(title);
	const metadata = {
		courseId: "",
		circleId: "",
		dueDate: "",
		taskType: "",
	};

	for (const segment of normalized.segments) {
		if (segment.type !== "widget") continue;

		if (segment.widgetType === "course" && !metadata.courseId) {
			metadata.courseId = segment.value?.courseId || "";
		}
		if (segment.widgetType === "circle" && !metadata.circleId) {
			metadata.circleId = segment.value?.circleId || "";
		}
		if (segment.widgetType === "date" && !metadata.dueDate) {
			metadata.dueDate = segment.value?.dueDate || "";
		}
		if (segment.widgetType === "taskType" && !metadata.taskType) {
			metadata.taskType = segment.value?.taskType || "";
		}
	}

	return metadata;
}

function buildTitleSegmentsFromMatches(text, matches) {
	const ordered = [...(matches || [])]
		.filter((match) => match?.kind !== "taskType")
		.sort((a, b) => a.start - b.start);
	const segments = [];
	let cursor = 0;

	for (const match of ordered) {
		if (cursor < match.start) {
			segments.push(makeTextSegment(text.slice(cursor, match.start)));
		}

		const widget = makeWidgetSegment(match);
		if (widget) {
			segments.push(widget);
		} else {
			segments.push(makeTextSegment(text.slice(match.start, match.end)));
		}

		cursor = match.end;
	}

	if (cursor < text.length) {
		segments.push(makeTextSegment(text.slice(cursor)));
	}

	if (!segments.length) {
		segments.push(makeTextSegment(""));
	}

	return { segments };
}

function convertMatchToWidget(match) {
	return makeWidgetSegment(match);
}

const RESERVED_WORDS = new Set([
	"due",
	"by",
	"today",
	"tonight",
	"tomorrow",
	"tmr",
	"tmrw",
	"tdy",
	"in",
	"and",
	"or",
	"the",
	"a",
	"an",
	"test",
	"quiz",
	"exam",
	"midterm",
	"final",
	"assignment",
	"homework",
	"work",
	"reading",
	"packet",
	"meeting"
]);

function countByNormalizedValue(items) {
	const map = new Map();
	for (const item of items) {
		const key = normalizeText(item || "");
		if (!key) continue;
		map.set(key, (map.get(key) || 0) + 1);
	}
	return map;
}

function toAliasList(aliasValue) {
	if (Array.isArray(aliasValue)) {
		return aliasValue.filter((value) => typeof value === "string");
	}

	if (typeof aliasValue === "string") {
		return [aliasValue];
	}

	return [];
}

function buildApDeAbbreviation(title = "") {
	const normalizedTitle = normalizeText(title);
	const tokens = normalizedTitle.split(/\s+/).filter(Boolean);
	if (!tokens.length) return "";

	const marker = tokens.find((token) => token === "ap" || token === "de");
	if (!marker) return "";

	const remainingTokens = tokens.filter((token) => token !== "ap" && token !== "de");
	if (remainingTokens.length < 2) return "";

	const suffix = remainingTokens
		.map((token) => {
			if (token.length <= 2) return token;
			return token[0];
		})
		.join("");

	const abbreviation = `${marker}${suffix}`;
	return abbreviation.length >= 4 ? abbreviation : "";
}

function findAliasSpans(text, alias) {
	if (!text || !alias) return [];

	const escaped = escapeRegex(alias).replace(/\s+/g, "\\s+");
	const regex = new RegExp(`\\b${escaped}\\b`, "ig");

	const spans = [];
	let match;

	while ((match = regex.exec(text)) !== null) {
		spans.push({
			start: match.index,
			end: match.index + match[0].length,
			rawText: match[0]
		});
	}

	return spans;
}

function findPrefixedTokenSpans(text, token) {
	if (!text || !token) return [];

	const escapedToken = escapeRegex(token);
	const regex = new RegExp(`\\b(ap|de)\\s+(${escapedToken})\\b`, "ig");
	const spans = [];
	let match;

	while ((match = regex.exec(text)) !== null) {
		spans.push({
			start: match.index,
			end: match.index + match[0].length,
			rawText: match[0],
			marker: (match[1] || "").toLowerCase(),
		});
	}

	return spans;
}

function chooseBestCandidate(candidates, minScore = 0.8, minMargin = 0.08) {
	if (!candidates.length) return null;

	const sorted = [...candidates].sort((a, b) => {
		if (b.confidence !== a.confidence) return b.confidence - a.confidence;
		return (b.end - b.start) - (a.end - a.start);
	});

	const best = sorted[0];
	const second = sorted[1];

	if (best.confidence < minScore) return null;
	if (second && best.confidence - second.confidence < minMargin) return null;

	return best;
}

function getUnclaimedRanges(text, matches) {
	const sorted = [...matches].filter(Boolean).sort((a, b) => a.start - b.start);
	const ranges = [];

	let cursor = 0;

	for (const match of sorted) {
		if (cursor < match.start) {
			ranges.push({
				start: cursor,
				end: match.start,
				text: text.slice(cursor, match.start)
			});
		}
		cursor = Math.max(cursor, match.end);
	}

	if (cursor < text.length) {
		ranges.push({
			start: cursor,
			end: text.length,
			text: text.slice(cursor)
		});
	}

	return ranges.filter((r) => r.text.trim());
}

function buildCourseIndex(courses) {
	const subjectCounts = countByNormalizedValue(courses.map((c) => c.subject));

	return courses.map((course) => {
		const aliases = [];
		const titleNorm = normalizeText(course.title);
		const subjectNorm = normalizeText(course.subject);
		const titleWords = titleNorm.split(" ").filter(Boolean);

		if (titleNorm) {
			aliases.push({
				value: titleNorm,
				type: "title",
				weight: 0.98
			});
		}

		if (subjectNorm) {
			const sharedCount = subjectCounts.get(subjectNorm) || 0;
			aliases.push({
				value: subjectNorm,
				type: "subject",
				weight: sharedCount >= 2 ? 0.66 : 0.9
			});
		}

		for (const customAlias of toAliasList(course.alias)) {
			const customAliasNorm = normalizeText(customAlias);
			if (!customAliasNorm) continue;

			aliases.push({
				value: customAliasNorm,
				type: "customAlias",
				weight: 0.91
			});
		}

		for (const word of titleWords) {
			if (
				word.length >= 4 &&
				!RESERVED_WORDS.has(word) &&
				word !== subjectNorm
			) {
				aliases.push({
					value: word,
					type: "titleWord",
					weight: 0.74
				});
			}
		}

		const apDeAbbreviation = buildApDeAbbreviation(course.title || "");
		if (apDeAbbreviation) {
			aliases.push({
				value: apDeAbbreviation,
				type: "apDeAbbrev",
				weight: 0.68
			});
		}

		const dedupedAliases = [];
		const seenAliasKeys = new Set();

		for (const alias of aliases) {
			const key = `${alias.type}::${alias.value}`;
			if (seenAliasKeys.has(key)) continue;

			seenAliasKeys.add(key);
			dedupedAliases.push(alias);
		}

		return {
			courseId: course.courseId,
			title: course.title,
			subject: course.subject,
			sharedSubject: (subjectCounts.get(subjectNorm) || 0) >= 2,
			aliases: dedupedAliases
		};
	});
}

function buildCircleIndex(circles) {
	return circles.map((circle) => {
		const aliases = [];
		const title = circle.title || circle.name || "";
		const titleNorm = normalizeText(title);
		const titleWords = titleNorm.split(" ").filter(Boolean);

		if (titleNorm) {
			aliases.push({
				value: titleNorm,
				type: "title",
				weight: 0.97
			});
		}

		for (const word of titleWords) {
			if (word.length >= 4 && !RESERVED_WORDS.has(word)) {
				aliases.push({
					value: word,
					type: "titleWord",
					weight: 0.72
				});
			}
		}

		return {
			circleId: circle.circleId || circle.id || circle.uid,
			title,
			aliases
		};
	});
}

const WEEKDAY_ALIASES = {
	sunday: 0,
	sun: 0,
	monday: 1,
	mon: 1,
	tuesday: 2,
	tue: 2,
	tues: 2,
	wednesday: 3,
	wed: 3,
	weds: 3,
	thursday: 4,
	thu: 4,
	thur: 4,
	thurs: 4,
	friday: 5,
	fri: 5,
	saturday: 6,
	sat: 6
};

const WEEKDAY_PATTERN =
	"sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat";

function detectDateCandidates(text, now = new Date()) {
	const matches = [];

	function collect(regex, handler) {
		let match;
		while ((match = regex.exec(text)) !== null) {
			const built = handler(match);
			if (built) matches.push(built);
		}
	}

	collect(/\b(tomorrow|tmr|tmrw)\b/gi, (match) => ({
		kind: "date",
		rawText: match[0],
		start: match.index,
		end: match.index + match[0].length,
		confidence: 0.99,
		data: {
			date: formatDateToISO(addDays(startOfDay(now), 1))
		}
	}));

	collect(/\b(today|tdy|tonight)\b/gi, (match) => ({
		kind: "date",
		rawText: match[0],
		start: match.index,
		end: match.index + match[0].length,
		confidence: 0.99,
		data: {
			date: formatDateToISO(startOfDay(now))
		}
	}));

	collect(/\bin\s+((?:\d{1,2}|a|an)\s+days?)\b/gi, (match) => {
		const countToken = (match[1] || "").split(/\s+/)[0]?.toLowerCase();
		const days = countToken === "a" || countToken === "an" ? 1 : Number(countToken);
		const phrase = extractMatchedSubphrase(match, match[1]);
		return {
			kind: "date",
			rawText: phrase.rawText,
			start: phrase.start,
			end: phrase.end,
			confidence: 0.96,
			data: {
				date: formatDateToISO(addDays(startOfDay(now), days))
			}
		};
	});

	collect(/\bin\s+(?:(\d{1,2})|(a|an))\s+weeks?\b/gi, (match) => {
		const weeks = match[1] ? Number(match[1]) : 1;
		const phrase = extractMatchedSubphrase(match, `${match[1] || match[2] || "1"} week${weeks === 1 ? "" : "s"}`);
		return {
			kind: "date",
			rawText: phrase.rawText,
			start: phrase.start,
			end: phrase.end,
			confidence: 0.95,
			data: {
				date: formatDateToISO(addWeeks(startOfDay(now), weeks))
			}
		};
	});

	collect(/\bin\s+(?:(\d{1,2})|(a|an))\s+months?\b/gi, (match) => {
		const months = match[1] ? Number(match[1]) : 1;
		const phrase = extractMatchedSubphrase(match, `${match[1] || match[2] || "1"} month${months === 1 ? "" : "s"}`);
		return {
			kind: "date",
			rawText: phrase.rawText,
			start: phrase.start,
			end: phrase.end,
			confidence: 0.95,
			data: {
				date: formatDateToISO(addMonths(startOfDay(now), months))
			}
		};
	});

	collect(/\b(\d{1,2})\s+days?\b/gi, (match) => {
		const before = text
			.slice(Math.max(0, match.index - 3), match.index)
			.toLowerCase();

		if (before.includes("in ")) return null;

		const days = Number(match[1]);
		return {
			kind: "date",
			rawText: match[0],
			start: match.index,
			end: match.index + match[0].length,
			confidence: 0.88,
			data: {
				date: formatDateToISO(addDays(startOfDay(now), days))
			}
		};
	});

	collect(/\b(?:(\d{1,2})|(a|an))\s+weeks?\b/gi, (match) => {
		const before = text
			.slice(Math.max(0, match.index - 3), match.index)
			.toLowerCase();

		if (before.includes("in ")) return null;

		const weeks = match[1] ? Number(match[1]) : 1;
		return {
			kind: "date",
			rawText: match[0],
			start: match.index,
			end: match.index + match[0].length,
			confidence: 0.87,
			data: {
				date: formatDateToISO(addWeeks(startOfDay(now), weeks))
			}
		};
	});

	collect(/\b(?:(\d{1,2})|(a|an))\s+months?\b/gi, (match) => {
		const before = text
			.slice(Math.max(0, match.index - 3), match.index)
			.toLowerCase();

		if (before.includes("in ")) return null;

		const months = match[1] ? Number(match[1]) : 1;
		return {
			kind: "date",
			rawText: match[0],
			start: match.index,
			end: match.index + match[0].length,
			confidence: 0.87,
			data: {
				date: formatDateToISO(addMonths(startOfDay(now), months))
			}
		};
	});

	collect(
		new RegExp(`\\b(?:by|due)\\s+(${WEEKDAY_PATTERN})\\b`, "gi"),
		(match) => {
			const weekdayName = match[1].toLowerCase();
			const weekday = WEEKDAY_ALIASES[weekdayName];
			if (weekday == null) return null;
			const phrase = extractMatchedSubphrase(match, match[1]);

			const date = getNextWeekday(weekday, now);
			return {
				kind: "date",
				rawText: phrase.rawText,
				start: phrase.start,
				end: phrase.end,
				confidence: 0.96,
				data: {
					date: formatDateToISO(date)
				}
			};
		}
	);

	collect(
		new RegExp(`\\b(${WEEKDAY_PATTERN})\\b`, "gi"),
		(match) => {
			const weekdayName = match[1].toLowerCase();
			const weekday = WEEKDAY_ALIASES[weekdayName];
			if (weekday == null) return null;

			const date = getNextWeekday(weekday, now);
			return {
				kind: "date",
				rawText: match[0],
				start: match.index,
				end: match.index + match[0].length,
				confidence: 0.93,
				data: {
					date: formatDateToISO(date)
				}
			};
		}
	);

	collect(/\b(?:by|due)\s+((\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)\b/gi, (match) => {
		let month = Number(match[2]);
		let day = Number(match[3]);
		let year = match[4] ? Number(match[4]) : now.getFullYear();
		const phrase = extractMatchedSubphrase(match, match[1]);

		if (year < 100) year += 2000;

		let parsed = new Date(year, month - 1, day);
		const valid =
			parsed.getFullYear() === year &&
			parsed.getMonth() === month - 1 &&
			parsed.getDate() === day;

		if (!valid) return null;

		if (!match[4] && startOfDay(parsed) < startOfDay(now)) {
			parsed = new Date(year + 1, month - 1, day);
		}

		return {
			kind: "date",
			rawText: phrase.rawText,
			start: phrase.start,
			end: phrase.end,
			confidence: 0.98,
			data: {
				date: formatDateToISO(parsed)
			}
		};
	});

	collect(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/gi, (match) => {
		let month = Number(match[1]);
		let day = Number(match[2]);
		let year = match[3] ? Number(match[3]) : now.getFullYear();

		if (year < 100) year += 2000;

		let parsed = new Date(year, month - 1, day);
		const valid =
			parsed.getFullYear() === year &&
			parsed.getMonth() === month - 1 &&
			parsed.getDate() === day;

		if (!valid) return null;

		if (!match[3] && startOfDay(parsed) < startOfDay(now)) {
			parsed = new Date(year + 1, month - 1, day);
		}

		return {
			kind: "date",
			rawText: match[0],
			start: match.index,
			end: match.index + match[0].length,
			confidence: 0.95,
			data: {
				date: formatDateToISO(parsed)
			}
		};
	});

	return matches;
}

function detectDate(text, now = new Date()) {
	return chooseBestCandidate(detectDateCandidates(text, now), 0.85, 0.02);
}

function detectTaskTypeCandidates(text) {
	const matches = [];
	const regex = /\b(test|quiz|exam|midterm|final)\b/gi;
	let match;

	while ((match = regex.exec(text)) !== null) {
		matches.push({
			kind: "taskType",
			rawText: match[0],
			start: match.index,
			end: match.index + match[0].length,
			confidence: 0.99,
			data: {
				taskType: "test"
			}
		});
	}

	return matches;
}

function detectTaskType(text) {
	const best = chooseBestCandidate(detectTaskTypeCandidates(text), 0.9, 0);
	return {
		taskType: best ? "test" : "assignment",
		match: best
	};
}

function detectCourseCandidates(text, indexedCourses) {
	const candidates = [];
	const normalizedText = normalizeText(text);

	const inputTokens = normalizedText
		.split(/\s+/)
		.filter(Boolean)
		.filter((token) => token.length >= 3 && !RESERVED_WORDS.has(token));

	for (const course of indexedCourses) {
		const titleTokens = normalizeText(course.title || "").split(/\s+/).filter(Boolean);
		const hasApMarker = titleTokens.includes("ap");
		const hasDeMarker = titleTokens.includes("de");

		for (const alias of course.aliases) {
			if (!alias.value) continue;

			for (const span of findAliasSpans(text, alias.value)) {
				candidates.push({
					kind: "course",
					rawText: span.rawText,
					start: span.start,
					end: span.end,
					confidence: clampConfidence(alias.weight),
					data: {
						courseId: course.courseId,
						title: course.title,
						subject: course.subject,
						matchedAlias: alias.value,
						aliasType: alias.type,
						matchTier:
							alias.type === "title"
								? 3
								: alias.type === "customAlias"
									? 3
								: alias.type === "titleWord"
									? 2
									: alias.type === "apDeAbbrev"
										? 2
									: alias.type === "subject"
										? 1
										: 1
					}
				});
			}
		}

		const titleNorm = normalizeText(course.title || "");
		const titleWords = titleNorm.split(/\s+/).filter(Boolean);

		for (const token of inputTokens) {
			for (const word of titleWords) {
				if (word.length >= 3 && word.startsWith(token) && token !== word) {
					const spans = findAliasSpans(text, token);

					for (const span of spans) {
						candidates.push({
							kind: "course",
							rawText: span.rawText,
							start: span.start,
							end: span.end,
							confidence: clampConfidence(0.84),
							data: {
								courseId: course.courseId,
								title: course.title,
								subject: course.subject,
								matchedAlias: token,
								aliasType: "titlePrefix",
								matchTier: 2
							}
						});
					}

					const prefixedSpans = findPrefixedTokenSpans(text, token).filter(
						(span) =>
							(span.marker === "ap" && hasApMarker) ||
							(span.marker === "de" && hasDeMarker)
					);

					for (const span of prefixedSpans) {
						candidates.push({
							kind: "course",
							rawText: span.rawText,
							start: span.start,
							end: span.end,
							confidence: clampConfidence(0.88),
							data: {
								courseId: course.courseId,
								title: course.title,
								subject: course.subject,
								matchedAlias: `${span.marker} ${token}`,
								aliasType: "prefixedTitlePrefix",
								matchTier: 2,
							}
						});
					}
				}
			}
		}

		const subjectNorm = normalizeText(course.subject || "");
		if (subjectNorm) {
			for (const token of inputTokens) {
				if (token === subjectNorm) {
					const spans = findAliasSpans(text, token);

					for (const span of spans) {
						candidates.push({
							kind: "course",
							rawText: span.rawText,
							start: span.start,
							end: span.end,
							confidence: clampConfidence(
								course.sharedSubject ? 0.58 : 0.72
							),
							data: {
								courseId: course.courseId,
								title: course.title,
								subject: course.subject,
								matchedAlias: token,
								aliasType: "subject",
								matchTier: 1
							}
						});
					}
				}
			}
		}
	}

	const deduped = new Map();

	for (const candidate of candidates) {
		const key = [
			candidate.start,
			candidate.end,
			candidate.data.courseId,
			candidate.data.aliasType
		].join("::");

		const existing = deduped.get(key);
		if (!existing || candidate.confidence > existing.confidence) {
			deduped.set(key, candidate);
		}
	}

	return Array.from(deduped.values());
}

function detectCourse(text, indexedCourses) {
	const candidates = detectCourseCandidates(text, indexedCourses);

	if (!candidates.length) return null;

	const sorted = [...candidates].sort((a, b) => {
		const aTier = a.data.matchTier || 0;
		const bTier = b.data.matchTier || 0;
		if (bTier !== aTier) return bTier - aTier;

		if (b.confidence !== a.confidence) return b.confidence - a.confidence;

		const aLen = a.end - a.start;
		const bLen = b.end - b.start;
		if (bLen !== aLen) return bLen - aLen;

		return String(a.data.courseId).localeCompare(String(b.data.courseId));
	});

	const strongTitleMatches = sorted.filter(
		(c) => (c.data.matchTier || 0) >= 3 && c.confidence >= 0.9
	);

	if (strongTitleMatches.length) return strongTitleMatches[0];

	const mediumTitleMatches = sorted.filter((c) => {
		if ((c.data.matchTier || 0) < 2) return false;

		const aliasType = c.data.aliasType;
		if (aliasType === "customAlias") return c.confidence >= 0.82;
		if (aliasType === "apDeAbbrev") return false;

		return c.confidence >= 0.74;
	});

	if (mediumTitleMatches.length) return mediumTitleMatches[0];

	const abbreviationMatches = sorted.filter(
		(c) => c.data.aliasType === "apDeAbbrev" && c.confidence >= 0.64
	);

	if (abbreviationMatches.length) return abbreviationMatches[0];

	const subjectMatches = sorted.filter(
		(c) => (c.data.matchTier || 0) === 1 && c.confidence >= 0.58
	);

	if (subjectMatches.length) {
		return subjectMatches[0];
	}

	return null;
}

function detectCircleCandidates(text, indexedCircles, offset = 0) {
	const candidates = [];
	const normalizedText = normalizeText(text);

	const inputTokens = normalizedText
		.split(/\s+/)
		.filter(Boolean)
		.filter((token) => token.length >= 3 && !RESERVED_WORDS.has(token));

	for (const circle of indexedCircles) {
		for (const alias of circle.aliases) {
			if (!alias.value) continue;

			for (const span of findAliasSpans(text, alias.value)) {
				candidates.push({
					kind: "circle",
					rawText: span.rawText,
					start: offset + span.start,
					end: offset + span.end,
					confidence: clampConfidence(alias.weight),
					data: {
						circleId: circle.circleId,
						title: circle.title,
						matchedAlias: alias.value,
						aliasType: alias.type,
						matchTier: alias.type === "title" ? 3 : 2
					}
				});
			}
		}

		const titleNorm = normalizeText(circle.title || "");
		const titleWords = titleNorm.split(/\s+/).filter(Boolean);

		for (const token of inputTokens) {
			for (const word of titleWords) {
				if (word.length >= 3 && word.startsWith(token) && token !== word) {
					for (const span of findAliasSpans(text, token)) {
						candidates.push({
							kind: "circle",
							rawText: span.rawText,
							start: offset + span.start,
							end: offset + span.end,
							confidence: 0.64,
							data: {
								circleId: circle.circleId,
								title: circle.title,
								matchedAlias: token,
								aliasType: "titlePrefix",
								matchTier: 1
							}
						});
					}
				}
			}
		}
	}

	const deduped = new Map();

	for (const candidate of candidates) {
		const key = [
			candidate.start,
			candidate.end,
			candidate.data.circleId,
			candidate.data.aliasType
		].join("::");

		const existing = deduped.get(key);
		if (!existing || candidate.confidence > existing.confidence) {
			deduped.set(key, candidate);
		}
	}

	return Array.from(deduped.values());
}

function detectCircle(text, indexedCircles, existingMatches = []) {
	const allCandidates = detectCircleCandidates(text, indexedCircles);

	const sorted = [...allCandidates].sort((a, b) => {
		const aTier = a.data.matchTier || 0;
		const bTier = b.data.matchTier || 0;
		if (bTier !== aTier) return bTier - aTier;

		if (b.confidence !== a.confidence) return b.confidence - a.confidence;

		const aLen = a.end - a.start;
		const bLen = b.end - b.start;
		if (bLen !== aLen) return bLen - aLen;

		return String(a.data.circleId).localeCompare(String(b.data.circleId));
	});

	const strong = sorted.filter(
		(c) => (c.data.matchTier || 0) >= 2 && c.confidence >= 0.72
	);

	if (strong.length) {
		return strong[0];
	}

	const unclaimedRanges = getUnclaimedRanges(text, existingMatches);

	let fallbackCandidates = [];

	for (const range of unclaimedRanges) {
		fallbackCandidates = fallbackCandidates.concat(
			detectCircleCandidates(range.text, indexedCircles, range.start)
		);
	}

	const fallbackSorted = fallbackCandidates.sort((a, b) => {
		if (b.confidence !== a.confidence) return b.confidence - a.confidence;

		const aLen = a.end - a.start;
		const bLen = b.end - b.start;
		if (bLen !== aLen) return bLen - aLen;

		return String(a.data.circleId).localeCompare(String(b.data.circleId));
	});

	const weak = fallbackSorted.filter((c) => c.confidence >= 0.6);
	return weak[0] || null;
}

function resolveMatches(rawMatches) {
	const matches = rawMatches.filter(Boolean).sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start;
		if (b.confidence !== a.confidence) return b.confidence - a.confidence;
		return (b.end - b.start) - (a.end - a.start);
	});

	const resolved = [];

	for (const match of matches) {
		let replaced = false;
		let blocked = false;

		for (let i = 0; i < resolved.length; i++) {
			const existing = resolved[i];

			if (rangesOverlap(match.start, match.end, existing.start, existing.end)) {
				const matchLen = match.end - match.start;
				const existingLen = existing.end - existing.start;

				const matchWins =
					match.confidence > existing.confidence ||
					(match.confidence === existing.confidence && matchLen > existingLen);

				if (matchWins) {
					resolved[i] = match;
					replaced = true;
				} else {
					blocked = true;
				}
				break;
			}
		}

		if (!replaced && !blocked) {
			resolved.push(match);
		}
	}

	return resolved.sort((a, b) => a.start - b.start);
}

function parseTaskInput(text, { courses = [], circles = [], now = new Date() } = {}) {
	const indexedCourses = buildCourseIndex(courses);
	const indexedCircles = buildCircleIndex(circles);

	const dateMatch = detectDate(text, now);
	const taskTypeResult = detectTaskType(text);
	const courseMatch = detectCourse(text, indexedCourses);

	const preliminaryMatches = resolveMatches([
		dateMatch,
		taskTypeResult.match,
		courseMatch
	]);

	const circleMatch = detectCircle(text, indexedCircles, preliminaryMatches);

	const matches = resolveMatches([
		dateMatch,
		taskTypeResult.match,
		courseMatch,
		circleMatch
	]);

	const resolvedCourse = matches.find((m) => m.kind === "course");
	const resolvedCircle = matches.find((m) => m.kind === "circle");
	const resolvedDate = matches.find((m) => m.kind === "date");
	const resolvedTaskType = matches.find((m) => m.kind === "taskType");

	return {
		rawText: text,
		matches,
		parsed: {
			courseId: resolvedCourse?.data?.courseId || "",
			circleId: resolvedCircle?.data?.circleId || "",
			dueDate: resolvedDate?.data?.date || "",
			taskType: resolvedTaskType?.data?.taskType || "assignment"
		}
	};
}

function parseTextToTaskTitle(text, options = {}) {
	const parseResult = parseTaskInput(text || "", options);
	const title = buildTitleSegmentsFromMatches(text || "", parseResult.matches);
	return {
		title,
		parseResult,
	};
}

export {
	normalizeTaskTitle,
	flattenTaskTitle,
	extractTaskTitleMetadata,
	parseTaskInput,
	parseTextToTaskTitle,
	convertMatchToWidget,
	makeTextSegment,
};