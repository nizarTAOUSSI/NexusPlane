import React from 'react';
import { GripVertical } from 'lucide-react';

interface WidgetShellProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const WidgetShell: React.FC<WidgetShellProps> = ({ title, icon, children, className = '' }) => (
  <div className={`dash-widget ${className}`.trim()}>
    <div className="dash-widget-head">
      <button type="button" className="dash-widget-drag" aria-label="Déplacer le widget">
        <GripVertical size={14} />
      </button>
      {icon && <span className="dash-widget-head-icon">{icon}</span>}
      <span className="dash-widget-title">{title}</span>
    </div>
    <div className="dash-widget-body">{children}</div>
  </div>
);

export default WidgetShell;
