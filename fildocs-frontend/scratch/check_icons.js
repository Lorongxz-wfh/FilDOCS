
import * as Lucide from 'lucide-react';

const icons = [
  'ChevronRight', 'FileText', 'Share2', 'Users', 'Calendar', 'Info', 'Trash2', 'Send', 'Save', 
  'ArrowLeft', 'MoreVertical', 'Pencil', 'CheckCircle2', 'AlertCircle', 'Loader2',
  'FileX', 'Library', 'XCircle', 'ArrowRightToLine', 'ArrowLeftCircle', 'Hash', 'Play', 'Layers', 'RefreshCcw'
];

icons.forEach(name => {
  if (!Lucide[name]) {
    console.log(`MISSING ICON: ${name}`);
  } else {
    // console.log(`OK: ${name}`);
  }
});
