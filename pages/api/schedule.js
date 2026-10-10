import { findDeterministicSlot, timeToMins } from '../../utils/scheduler';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { task, availableSlots, existingEvents, existingTasks } = req.body;

  if (!task || !Array.isArray(availableSlots) || !task.title?.trim() || Number(task.duration) <= 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // 1. Genuinely no free time? Reject early before calling AI.
  if (availableSlots.length === 0) {
    return res.status(200).json({
      recommendedStart: null,
      recommendedEnd: null,
      reason: 'No open availability fits this task duration.',
      source: 'server_engine'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const fallbackSlot = findDeterministicSlot(task, availableSlots, existingEvents, existingTasks);

  // 2. Fallback if no AI key is configured
  if (!apiKey) {
    return res.status(200).json({ ...fallbackSlot, source: 'algorithmic_fallback' });
  }

  // 3. Call Gemini Securely
  try {
    const prompt = `
You are an AI scheduler. Pick the BEST slot for this task:
Task: "${task.title}" (Duration: ${task.duration} mins, Priority: ${task.priority})
Deadline: ${task.deadline || 'None'}

Valid Candidate Slots (You MUST pick from these exact intervals):
${JSON.stringify(availableSlots, null, 2)}

Respond in pure JSON matching exactly this format:
{
  "recommendedStart": "YYYY-MM-DDTHH:mm",
  "recommendedEnd": "YYYY-MM-DDTHH:mm",
  "reason": "Why this slot?",
  "confidence": "high"
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
    const candidate = availableSlots.find(slot =>
      `${slot.date}T${slot.start}` === parsed.recommendedStart
      && timeToMins(parsed.recommendedEnd?.split('T')[1]) - timeToMins(slot.start) >= Number(task.duration)
      && timeToMins(parsed.recommendedEnd?.split('T')[1]) <= timeToMins(slot.end)
    );
    if (!candidate) throw new Error('Gemini returned a slot outside the valid candidates.');

    return res.status(200).json({ ...parsed, source: 'gemini' });
  } catch (error) {
    console.error('Gemini error, using fallback:', error.message);
    return res.status(200).json({ ...fallbackSlot, source: 'algorithmic_fallback' });
  }
}
