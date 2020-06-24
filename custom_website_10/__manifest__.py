# -*- coding: utf-8 -*-
##############################################################################
#
#    Samples module for Odoo 10 custom website customization
#    Copyright (c) 2018 Copyright (c) 2018 aek
#      Anicet Eric Kouame <anicetkeric@gmail.com>
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

{
    'name': 'Custom Website',
    'version': '10.0',
    'summary': """This module provides feature for changing layout of website.""",
    'description': "This module provides feature for changing layout of website.",
    'category': "Theme",
    'author': 'Anicet Eric Kouame',
    'company': 'AEK',
    'website': "https://github.com/anicetkeric",
    'depends': ['website'],
    'data': [
        'views/theme.xml',
    ],
    'demo': [
    ],
    'images': ['images/screen.jpg'],
    'license': 'AGPL-3',
    'installable': True,
    'application': True,
}
