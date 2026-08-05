import { addToast } from '@heroui/toast';

export const displayToast = (message: string, type: 'success' | 'error') => {
  addToast({
    title: type === 'success' ? 'Success' : 'Error',
    description: message,
    color: type === 'success' ? 'success' : 'danger',
  });
};
