import React from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
} from 'lucide-react';

interface WeatherIconProps {
  name: string;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({ name, className = 'w-6 h-6' }) => {
  switch (name) {
    case 'sun':
      return <Sun className={`${className} text-amber-400`} />;
    case 'cloud-sun':
    case 'cloud-Sun-rain':
      return <CloudSun className={`${className} text-amber-300`} />;
    case 'cloud':
      return <Cloud className={`${className} text-slate-400`} />;
    case 'cloud-fog':
      return <CloudFog className={`${className} text-slate-400`} />;
    case 'cloud-drizzle':
      return <CloudDrizzle className={`${className} text-sky-400`} />;
    case 'cloud-rain':
      return <CloudRain className={`${className} text-blue-400`} />;
    case 'snowflake':
      return <Snowflake className={`${className} text-cyan-300`} />;
    case 'cloud-lightning':
      return <CloudLightning className={`${className} text-yellow-400`} />;
    default:
      return <CloudSun className={`${className} text-amber-300`} />;
  }
};

