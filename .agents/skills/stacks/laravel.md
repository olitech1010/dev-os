---
name: laravel-stack
description: Stack standard for Laravel 12, MySQL, cPanel
---
# Laravel 12 Stack Standard

## Tech Stack
- Framework: Laravel 12
- Language: PHP 8.2+
- Database: MySQL
- Hosting: cPanel

## Standards
- **Architecture:** Use strict MVC or Action/Domain patterns. Avoid logic in routes or controllers; push to services/actions.
- **Database:** Use Eloquent ORM. Always create migrations and seeders for new tables.
- **Security:** Use CSRF protection, parameter binding (built into Eloquent), and strict validation via FormRequests.
- **Deployment (cPanel):** Ensure `public/` is mapped correctly. Configure `.htaccess` for routing. Run `php artisan optimize` on deploy.
- **Testing:** Write tests using Pest or PHPUnit.
