export interface Settings {
  id: number;
  theme: 'dark' | 'light';
  wallpaper_url: string;
  card_opacity: number;
  parent_pin?: string;
  has_pin?: boolean;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  prayer_method: number;
  ical_url: string;
}

export interface Member {
  id: number;
  name: string;
  role: string;
  color: string;
  avatar: string;
  points: number;
  goal_points: number;
  display_order: number;
}

export type TaskStatus = 'todo' | 'pending' | 'validated';

export interface DailyTask {
  id: number;
  title: string;
  member_id: number | null;
  member_name?: string | null;
  member_color?: string | null;
  member_avatar?: string | null;
  days_of_week: number[]; // 0=Lundi .. 6=Dimanche
  points_reward: number;
  icon: string;
  status: TaskStatus;
  completed: boolean;
}

export interface CalendarEvent {
  id: number;
  title: string;
  member_id: number | null;
  member_name?: string | null;
  member_color?: string | null;
  member_avatar?: string | null;
  category_color: string;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  location: string;
  description: string;
  source: string;
}

export interface Goal {
  id: number;
  title: string;
  period_type: 'weekly' | 'monthly';
  period_key: string;
  completed: boolean;
  member_id: number | null;
  member_name?: string | null;
  member_color?: string | null;
  member_avatar?: string | null;
  points_reward: number;
  rolled_over_count: number;
}

export interface GoalsResponse {
  current_week: string;
  current_month: string;
  weekly: Goal[];
  monthly: Goal[];
}

export interface Recipe {
  id: number;
  title: string;
  category: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  image_url: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
}

export interface WeatherHour {
  time: string;
  temp: number;
  code: number;
  description: string;
  icon: string;
}

export interface WeatherData {
  city: string;
  country: string;
  current: {
    temp: number;
    feels_like: number;
    code: number;
    description: string;
    icon: string;
    wind_kmh: number;
  };
  hourly: WeatherHour[];
  offline: boolean;
}

export interface PrayerTimings {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerData {
  city: string;
  country: string;
  method: number;
  date: string;
  hijri_label: string;
  timings: PrayerTimings;
  offline: boolean;
}

