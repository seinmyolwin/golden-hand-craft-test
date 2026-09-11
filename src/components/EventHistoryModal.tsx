import React from 'react';
import { AuditLogEntry } from '../types';
import { AuditHistoryModal } from './AuditHistoryModal';

interface EventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLogEntry[];
  onClearLogs?: () => void;
}

export const EventHistoryModal: React.FC<EventHistoryModalProps> = ({
  isOpen,
  onClose,
  auditLogs = [],
}) => {
  return <AuditHistoryModal isOpen={isOpen} onClose={onClose} auditLogs={auditLogs} />;
};
