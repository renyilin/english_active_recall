
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import QuizIcon from '@mui/icons-material/Quiz';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getCurrentTab = () => {
    if (location.pathname === '/study') return 1;
    if (location.pathname === '/test') return 2;
    return 0;
  };

  const currentTab = getCurrentTab();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Flash Cards
          </Typography>
          {!isMobile && (
            <>
              <Button
                color="inherit"
                startIcon={<MenuBookIcon />}
                onClick={() => navigate('/')}
                sx={{ mr: 1 }}
              >
                Library
              </Button>
              <Button
                color="inherit"
                startIcon={<SchoolIcon />}
                onClick={() => navigate('/study')}
                sx={{ mr: 1 }}
              >
                Study
              </Button>
              <Button
                color="inherit"
                startIcon={<QuizIcon />}
                onClick={() => navigate('/test')}
                sx={{ mr: 2 }}
              >
                Test
              </Button>
            </>
          )}
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.email}
          </Typography>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box component="main" sx={{ flex: 1, pb: isMobile ? 7 : 0 }}>
        <Outlet />
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
          <BottomNavigation
            value={currentTab}
            onChange={(_, newValue) => {
              if (newValue === 0) navigate('/');
              else if (newValue === 1) navigate('/study');
              else if (newValue === 2) navigate('/test');
            }}
            showLabels
          >
            <BottomNavigationAction label="Library" icon={<MenuBookIcon />} />
            <BottomNavigationAction label="Study" icon={<SchoolIcon />} />
            <BottomNavigationAction label="Test" icon={<QuizIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
