# -*- coding: utf-8 -*-
# © 2004-2009 Tiny SPRL (<http://tiny.be>).
# © 2014-2017 Tecnativa - Pedro M. Baeza
# © 2016 ACSONE SA/NV (<http://acsone.eu>)
# License AGPL-3 - See http://www.gnu.org/licenses/agpl-3.0.html
{
    "name": "Purchase order lines with Fixed Quantities Discounts",
    "author": "Islam Abdelmaaboud",
    'website': "http://www.itss-c.com",

    "version": "11.1.0.1",
    "category": "Purchase Management",
    "depends": ["purchase"],
    "data": [
        "views/purchase_discount_view.xml",
        "views/report_purchaseorder.xml",
    ],
    "license": 'AGPL-3',
    'installable': True,
    'images': ['images/purchase_discount.png'],
}
