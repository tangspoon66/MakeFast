/** 按路由设置浏览器标签标题（评委/家长多开标签时好分辨） */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { titleFor } from './routeTitles';

export function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titleFor(pathname); }, [pathname]);
  return null;
}
