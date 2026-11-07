import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

/** 保护个人版工作台：游客可以看课程目录，但不能进入 Agent 和设备操作。 */
export function LearnerProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading, checkSession } = useLearnerAuthStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    void checkSession().finally(() => setHasChecked(true));
  }, [checkSession]);

  if (!hasChecked || isLoading) {
    return (
      <div className="learner-loading-screen">
        <LoadingSpinner message="正在确认你的学习空间..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
