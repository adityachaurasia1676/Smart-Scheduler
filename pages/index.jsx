import React, { useState, useEffect } from 'react';
import { calculateFreeSlots } from '../utils/scheduler';
import {
  CalendarDays, CheckCircle, Clock, AlertTriangle,
  Plus, Trash2, Calendar
} from 'lucide-react';

export default function SmartScheduler() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- Global App State ---
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [availability, setAvailability] = useState({
    Monday: [{ start: '09:00', end: '17:00' }],
    Tuesday: [{ start: '09:00', end: '17:00' }],
    Wednesday: [{ start: '09:00', end: '17:00' }],
    Thursday: [{ start: '09:00', end: '17:00' }],
    Friday: [{ start: '09:00', end: '17:00' }],
    Saturday: [],
    Sunday: []
  });

  // --- Form States ---
  const [newTask, setNewTask] = useState({ title: '', duration: 60, priority: 'Medium', deadline: '' });
  const [newEvent, setNewEvent] = useState({ title: '', date: '', startTime: '', endTime: '' });

  // --- AI Scheduling UI State ---
  const [aiLoading, setAiLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [targetTask, setTargetTask] = useState(null);

  // --- Hydration & Persistence ---
  useEffect(() => {
    setIsMounted(true);
    const savedTasks = localStorage.getItem('smart_tasks');
    const savedEvents = localStorage.getItem('smart_events');
    const savedAvail = localStorage.getItem('smart_availability');

    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedAvail) setAvailability(JSON.parse(savedAvail));
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('smart_tasks', JSON.stringify(tasks));
      localStorage.setItem('smart_events', JSON.stringify(events));
      localStorage.setItem('smart_availability', JSON.stringify(availability));
    }
  }, [tasks, events, availability, isMounted]);

  if (!isMounted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500">Loading Scheduler...</div>;

  // --- Action Handlers ---
  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    setTasks([...tasks, { ...newTask, id: Date.now().toString(), status: 'Pending', scheduledStart: null }]);
    setNewTask({ title: '', duration: 60, priority: 'Medium', deadline: '' });
  };

  const addEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) return;
    setEvents([...events, { ...newEvent, id: Date.now().toString() }]);
    setNewEvent({ title: '', date: '', startTime: '', endTime: '' });
  };

  const deleteTask = (id) => setTasks(tasks.filter(t => t.id !== id));
  const deleteEvent = (id) => setEvents(events.filter(e => e.id !== id));

  const toggleTaskComplete = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' } : t));
  };

  // --- AI Scheduling Engine ---
  const handleScheduleTask = async (task) => {
    setAiLoading(true);
    setTargetTask(task);
    setRecommendation(null);

    // Check for free slots over the next 4 days starting from today
    const datesToCheck = Array.from({ length: 4 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    let computedSlots = [];
    for (const date of datesToCheck) {
      computedSlots.push(...calculateFreeSlots(date, task.duration, availability, events, tasks));
    }

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, availableSlots: computedSlots, existingEvents: events, existingTasks: tasks })
      });
      const data = await res.json();
      setRecommendation(data);
    } catch (err) {
      alert('Failed to fetch recommendation. Ensure your server is running.');
    } finally {
      setAiLoading(false);
    }
  };

  const acceptRecommendation = () => {
    if (!recommendation || !recommendation.recommendedStart) return;

    const [date, startTime] = recommendation.recommendedStart.split('T');
    const endTime = recommendation.recommendedEnd.split('T')[1];

    setTasks(tasks.map(t =>
      t.id === targetTask.id
        ? { ...t, scheduledDate: date, scheduledStart: startTime, scheduledEnd: endTime, status: 'Pending' }
        : t
    ));
    setRecommendation(null);
    setTargetTask(null);
  };

  // --- UI Helpers ---
  const getPriorityColor = (priority) => {
    if (priority === 'High') return 'text-red-600 bg-red-100';
    if (priority === 'Medium') return 'text-orange-600 bg-orange-100';
    return 'text-blue-600 bg-blue-100';
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter(t => t.status === 'Pending');
  const completedTasks = tasks.filter(t => t.status === 'Completed');
  const todayEvents = events.filter(e => e.date === todayStr);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-white shadow-sm border-b px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <CalendarDays className="w-6 h-6" /> Smart Scheduler
        </h1>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          {['dashboard', 'tasks', 'events', 'availability'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`capitalize px-4 py-2 rounded-md font-medium transition whitespace-nowrap ${
                activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-6 pb-24">
        {/* Recommendation Modal */}
        {targetTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900">
                AI Scheduling: {targetTask.title}
              </h2>

              {aiLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-20 bg-slate-100 rounded mt-4"></div>
                </div>
              ) : recommendation && recommendation.recommendedStart ? (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <p className="font-semibold text-indigo-900 text-lg">
                      {recommendation.recommendedStart.split('T')[0]}
                    </p>
                    <p className="font-bold text-indigo-600 text-xl">
                      {recommendation.recommendedStart.split('T')[1]} - {recommendation.recommendedEnd.split('T')[1]}
                    </p>
                    <p className="text-sm text-indigo-800 mt-3">{recommendation.reason}</p>
                    <div className="mt-3 inline-flex text-xs bg-white text-indigo-500 px-2 py-1 rounded border border-indigo-100">
                      Source: {recommendation.source}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={acceptRecommendation} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition">
                      Accept Slot
                    </button>
                    <button onClick={() => { setTargetTask(null); setRecommendation(null); }} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
                    <AlertTriangle className="w-5 h-5 mb-2" />
                    {recommendation?.reason || 'No available slots found for this task duration within your working hours.'}
                  </div>
                  <button onClick={() => { setTargetTask(null); setRecommendation(null); }} className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-slate-500 font-medium mb-1">Pending Tasks</h3>
                <p className="text-3xl font-bold text-slate-800">{pendingTasks.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-slate-500 font-medium mb-1">Today's Events</h3>
                <p className="text-3xl font-bold text-slate-800">{todayEvents.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-slate-500 font-medium mb-1">Completed</h3>
                <p className="text-3xl font-bold text-green-600">{completedTasks.length}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Needs Scheduling */}
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" /> Unscheduled Tasks
                </h2>
                <div className="space-y-3">
                  {pendingTasks.filter(t => !t.scheduledStart).map(task => (
                    <div key={task.id} className="flex justify-between items-center p-3 border border-slate-100 bg-slate-50 rounded-lg hover:border-indigo-300 transition">
                      <div>
                        <p className="font-semibold text-slate-800">{task.title}</p>
                        <p className="text-sm text-slate-500">{task.duration} mins • <span className={getPriorityColor(task.priority) + ' px-1.5 rounded text-xs'}>{task.priority}</span></p>
                      </div>
                      <button
                        onClick={() => handleScheduleTask(task)}
                        className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-200 text-sm font-medium transition"
                      >
                        Auto-Schedule
                      </button>
                    </div>
                  ))}
                  {pendingTasks.filter(t => !t.scheduledStart).length === 0 && (
                    <p className="text-slate-400 text-center py-6 text-sm">All tasks are scheduled!</p>
                  )}
                </div>
              </div>

              {/* Scheduled Today */}
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" /> Today's Schedule
                </h2>
                <div className="space-y-3 relative">
                  {/* Events */}
                  {todayEvents.map(event => (
                    <div key={event.id} className="p-3 border-l-4 border-l-blue-500 bg-blue-50 rounded-r-lg">
                      <p className="font-semibold text-blue-900">{event.title}</p>
                      <p className="text-sm text-blue-700">{event.startTime} - {event.endTime}</p>
                    </div>
                  ))}
                  {/* Scheduled Tasks */}
                  {pendingTasks.filter(t => t.scheduledDate === todayStr).map(task => (
                    <div key={task.id} className="p-3 border-l-4 border-l-indigo-500 bg-indigo-50 rounded-r-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-indigo-900">{task.title}</p>
                        <p className="text-sm text-indigo-700">{task.scheduledStart} - {task.scheduledEnd}</p>
                      </div>
                      <button onClick={() => toggleTaskComplete(task.id)} className="text-indigo-600 hover:text-indigo-800" aria-label={`Complete ${task.title}`}>
                        <CheckCircle className="w-6 h-6" />
                      </button>
                    </div>
                  ))}
                  {todayEvents.length === 0 && pendingTasks.filter(t => t.scheduledDate === todayStr).length === 0 && (
                    <p className="text-slate-400 text-center py-6 text-sm">Nothing scheduled for today.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-lg font-bold mb-4">Add New Task</h2>
              <form onSubmit={addTask} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Task Title</label>
                  <input type="text" required value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Study for OS Midterm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Duration (mins)</label>
                  <input type="number" min="15" step="15" required value={newTask.duration} onChange={e => setNewTask({ ...newTask, duration: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition flex items-center gap-2 font-medium">
                    <Plus className="w-4 h-4" /> Add Task
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-lg font-bold mb-4">All Tasks</h2>
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className={`flex justify-between items-center p-4 border rounded-lg ${task.status === 'Completed' ? 'bg-slate-50 opacity-75' : 'bg-white'}`}>
                    <div>
                      <p className={`font-semibold ${task.status === 'Completed' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.title}</p>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span>{task.duration} mins</span>
                        <span className={getPriorityColor(task.priority) + ' px-1.5 rounded text-xs'}>{task.priority}</span>
                        {task.scheduledStart && (
                          <span className="text-indigo-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {task.scheduledDate} ({task.scheduledStart})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleTaskComplete(task.id)} className={`p-2 rounded-md ${task.status === 'Completed' ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`} aria-label={`Toggle ${task.title} completion`}>
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="p-2 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition" aria-label={`Delete ${task.title}`}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && <p className="text-slate-500 text-center py-4">No tasks added yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-lg font-bold mb-4">Add Fixed Event</h2>
              <form onSubmit={addEvent} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Event Title</label>
                  <input type="text" required value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Physics Lecture" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" required value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Start Time</label>
                  <input type="time" required value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">End Time</label>
                  <input type="time" required value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition flex items-center gap-2 font-medium">
                    <Plus className="w-4 h-4" /> Add Event
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-lg font-bold mb-4">All Fixed Events</h2>
              <div className="space-y-2">
                {[...events].sort((a, b) => new Date(a.date) - new Date(b.date)).map(event => (
                  <div key={event.id} className="flex justify-between items-center p-4 border rounded-lg bg-white">
                    <div>
                      <p className="font-semibold text-slate-800">{event.title}</p>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span><Calendar className="w-3 h-3 inline mr-1" />{event.date}</span>
                        <span><Clock className="w-3 h-3 inline mr-1" />{event.startTime} - {event.endTime}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteEvent(event.id)} className="p-2 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition" aria-label={`Delete ${event.title}`}>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {events.length === 0 && <p className="text-slate-500 text-center py-4">No events added yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* AVAILABILITY TAB */}
        {activeTab === 'availability' && (
          <div className="bg-white p-6 rounded-xl border shadow-sm max-w-2xl">
            <h2 className="text-lg font-bold mb-4">Working Hours (Availability)</h2>
            <p className="text-sm text-slate-500 mb-6">Define the time blocks where the AI is allowed to schedule tasks for you.</p>

            <div className="space-y-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24 font-medium text-slate-700">{day}</div>
                  {availability[day] && availability[day].length > 0 ? (
                    <div className="flex gap-2 items-center flex-1">
                      <input
                        type="time"
                        value={availability[day][0].start}
                        onChange={(e) => setAvailability({ ...availability, [day]: [{ ...availability[day][0], start: e.target.value }] })}
                        className="p-2 border rounded-md outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="time"
                        value={availability[day][0].end}
                        onChange={(e) => setAvailability({ ...availability, [day]: [{ ...availability[day][0], end: e.target.value }] })}
                        className="p-2 border rounded-md outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                      <button
                        onClick={() => setAvailability({ ...availability, [day]: [] })}
                        className="ml-auto text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex justify-between items-center bg-slate-50 p-2 rounded-md border border-dashed border-slate-200">
                      <span className="text-sm text-slate-400 italic">No availability</span>
                      <button
                        onClick={() => setAvailability({ ...availability, [day]: [{ start: '09:00', end: '17:00' }] })}
                        className="text-xs bg-white border shadow-sm px-3 py-1 rounded text-slate-600 hover:bg-slate-50"
                      >
                        Add Hours
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
