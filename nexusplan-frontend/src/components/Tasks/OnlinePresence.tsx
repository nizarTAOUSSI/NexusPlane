import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type UserMeta } from '../../types/task';

interface OnlinePresenceProps {
  isConnected:   boolean;
  onlineUserIds: Set<string>;
  userMap:       Record<string, UserMeta>;
  currentUserId: string | null;
}

const MAX_VISIBLE = 4;

function initials(m: UserMeta) {
  return (m.username || m.email || '?').slice(0, 2).toUpperCase();
}

const OnlinePresence: React.FC<OnlinePresenceProps> = ({
  isConnected,
  onlineUserIds,
  userMap,
  currentUserId,
}) => {
  const othersIds  = [...onlineUserIds].filter(id => id !== currentUserId);
  const visible    = othersIds.slice(0, MAX_VISIBLE);
  const extra      = othersIds.length - MAX_VISIBLE;
  const totalOnline = othersIds.length; 

  return (
    <div className="op-container">
      <div className={`op-status ${isConnected ? 'op-status--online' : 'op-status--offline'}`}>
        {isConnected ? (
          <>
            <span className="op-dot op-dot--online" />
            <Wifi size={13} />
            {totalOnline > 0 && (
              <span className="op-count">{totalOnline} online</span>
            )}
          </>
        ) : (
          <>
            <span className="op-dot op-dot--offline" />
            <WifiOff size={13} />
            <span className="op-count op-count--offline">Connecting…</span>
          </>
        )}
      </div>

      <AnimatePresence>
        {visible.length > 0 && (
          <motion.div
            className="op-avatars"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            {visible.map((uid, i) => {
              const meta = userMap[uid];
              return (
                <motion.div
                  key={uid}
                  className="op-av"
                  style={{ zIndex: MAX_VISIBLE - i }}
                  title={meta?.username || meta?.email || uid}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  {meta?.avatar ? (
                    <img src={meta.avatar} alt="" className="op-av-img" />
                  ) : meta ? (
                    <span className="op-av-init">{initials(meta)}</span>
                  ) : (
                    <span className="op-av-init">?</span>
                  )}
                </motion.div>
              );
            })}
            {extra > 0 && (
              <div className="op-av op-av--extra" title={`${extra} more online`}>
                +{extra}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnlinePresence;
