import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { PlayCircle, StopCircle, Loader2, BookOpen, CheckCircle2, AlertCircle, Clock, Trophy } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [currentCourse, setCurrentCourse] = useState(null);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      toast.info('Logging into LMS... This may take 20-30 seconds');
      const response = await axios.post(`${API}/lms/courses`, credentials, {
        timeout: 90000 // 90 second timeout
      });
      if (response.data.success) {
        setCourses(response.data.courses);
        setIsLoggedIn(true);
        toast.success(`Found ${response.data.courses.length} courses`);
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
        toast.error('Login timeout - Please try again. The server might be busy.');
      } else {
        toast.error('Failed to fetch courses: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoadingCourses(false);
    }
  };

  const startAutomation = async (courseTitle = null) => {
    try {
      const response = await axios.post(`${API}/lms/start`, {
        email: credentials.email,
        password: credentials.password,
        course_title: courseTitle
      });

      if (response.data.success) {
        setSessionId(response.data.session_id);
        setIsRunning(true);
        setCurrentCourse(courseTitle || 'Next available');
        setLogs([]);
        toast.success('Automation started!');
        
        // Start polling for logs and status
        startPolling(response.data.session_id);
      }
    } catch (error) {
      toast.error('Failed to start automation: ' + (error.response?.data?.detail || error.message));
    }
  };

  const stopAutomation = async () => {
    if (!sessionId) return;
    
    try {
      await axios.post(`${API}/lms/stop/${sessionId}`);
      setIsRunning(false);
      toast.info('Automation stopped');
    } catch (error) {
      toast.error('Failed to stop automation: ' + (error.response?.data?.detail || error.message));
    }
  };

  const startPolling = (sid) => {
    const pollInterval = setInterval(async () => {
      try {
        // Fetch logs
        const logsRes = await axios.get(`${API}/lms/logs/${sid}`);
        setLogs(logsRes.data.logs || []);

        // Fetch status
        const statusRes = await axios.get(`${API}/lms/status/${sid}`);
        setStatus(statusRes.data);

        // Check if completed
        if (['completed', 'failed', 'stopped'].includes(statusRes.data.status)) {
          clearInterval(pollInterval);
          setIsRunning(false);
          
          if (statusRes.data.status === 'completed') {
            const result = statusRes.data.result;
            if (result?.result === 'final_quiz_ready') {
              toast.success('🎯 Course completed! Final quiz is ready.');
            } else {
              toast.success('Automation completed successfully!');
            }
            // Refresh courses
            fetchCourses();
          } else if (statusRes.data.status === 'failed') {
            toast.error('Automation failed: ' + (statusRes.data.error || 'Unknown error'));
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    // Cleanup
    return () => clearInterval(pollInterval);
  };

  const getStatusBadge = (courseStatus) => {
    const statusConfig = {
      overdue: { variant: 'destructive', icon: AlertCircle, label: 'Overdue' },
      in_progress: { variant: 'default', icon: Clock, label: 'In Progress' },
      needs_retake: { variant: 'secondary', icon: BookOpen, label: 'Needs Retake' },
      not_started: { variant: 'secondary', icon: BookOpen, label: 'Not Started' },
      ready_for_quiz: { variant: 'default', icon: Trophy, label: 'Quiz Ready - Skip' },
      current: { variant: 'default', icon: Clock, label: 'Current' }
    };

    const config = statusConfig[courseStatus] || statusConfig.current;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getLogLevelColor = (level) => {
    const colors = {
      info: 'text-blue-400',
      error: 'text-red-400',
      warning: 'text-yellow-400',
      success: 'text-green-400'
    };
    return colors[level] || 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-8">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            LMS Training Automation
          </h1>
          <p className="text-slate-400 text-lg">Automate your YourHippo training courses</p>
        </div>

        {/* Login Section */}
        {!isLoggedIn && (
          <Card className="max-w-md mx-auto bg-slate-800/50 border-slate-700 backdrop-blur-sm" data-testid="login-card">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-100">Login to LMS</CardTitle>
              <CardDescription className="text-slate-400">Enter your YourHippo credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="bg-slate-900/50 border-slate-600 text-slate-100"
                  data-testid="email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="bg-slate-900/50 border-slate-600 text-slate-100"
                  data-testid="password-input"
                />
              </div>
              <Button
                onClick={fetchCourses}
                disabled={loadingCourses || !credentials.email || !credentials.password}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="login-button"
              >
                {loadingCourses ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</>
                ) : (
                  'Fetch Courses'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard */}
        {isLoggedIn && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Courses List */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm" data-testid="courses-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl text-slate-100">Your Courses</CardTitle>
                    <CardDescription className="text-slate-400">{courses.length} courses found</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCourses}
                    disabled={loadingCourses}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    data-testid="refresh-courses-button"
                  >
                    {loadingCourses ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {courses.map((course, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-all space-y-3"
                        data-testid={`course-card-${index}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-100 mb-1">{course.title}</h3>
                            {getStatusBadge(course.status)}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => startAutomation(course.title)}
                            disabled={isRunning || course.status === 'ready_for_quiz'}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                            data-testid={`start-course-${index}`}
                            title={course.status === 'ready_for_quiz' ? 'Course videos completed - Take final quiz yourself' : 'Start automation'}
                          >
                            {course.status === 'ready_for_quiz' ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Skip
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Start
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Progress</span>
                            <span className="text-slate-300 font-medium">{course.progress}</span>
                          </div>
                          <Progress
                            value={parseInt(course.progress)}
                            className="h-2 bg-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Automation Status & Logs */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm" data-testid="automation-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl text-slate-100">Automation Status</CardTitle>
                    <CardDescription className="text-slate-400">
                      {isRunning ? `Running: ${currentCourse}` : 'Ready to start'}
                    </CardDescription>
                  </div>
                  {isRunning && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopAutomation}
                      data-testid="stop-automation-button"
                    >
                      <StopCircle className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Start */}
                {!isRunning && (
                  <Button
                    onClick={() => startAutomation()}
                    className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white"
                    data-testid="quick-start-button"
                  >
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Quick Start (Next Available Course)
                  </Button>
                )}

                {/* Status Info */}
                {status && (
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 space-y-2" data-testid="status-info">
                    <div className="flex items-center gap-2">
                      {status.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                      {status.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                      {status.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-400" />}
                      <span className="font-semibold text-slate-200 capitalize">{status.status}</span>
                    </div>
                    {status.result && status.result.result === 'final_quiz_ready' && (
                      <div className="text-emerald-400 font-medium flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Final quiz is ready to take!
                      </div>
                    )}
                  </div>
                )}

                {/* Logs */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-200">Activity Log</h3>
                  <ScrollArea className="h-[350px] rounded-lg bg-slate-950/50 border border-slate-700 p-4">
                    <div className="space-y-2 font-mono text-sm" data-testid="activity-log">
                      {logs.length === 0 ? (
                        <p className="text-slate-500">No activity yet...</p>
                      ) : (
                        logs.map((log, index) => (
                          <div key={index} className="flex gap-2 text-xs">
                            <span className="text-slate-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={getLogLevelColor(log.level)}>{log.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
