# -*- coding: utf-8 -*-
from odoo import api, fields, models, _

import logging
import ast

_logger = logging.getLogger(__name__)


class res_partner(models.Model):
    _inherit = "res.partner"

    wallet = fields.Float(digits=(16, 4),
                          compute='_compute_wallet', string='Wallet amount', help='This wallet amount of customer, keep all money change when paid order on pos')
    credit = fields.Float(digits=(16, 4),
                          compute='_compute_debit_credit_balance', string='Credit', help='Credit amount of this customer can use')
    debit = fields.Float(digits=(16, 4),
                         compute='_compute_debit_credit_balance', string='Debit', help='Debit amount of this customer')
    balance = fields.Float(digits=(16, 4),
                           compute='_compute_debit_credit_balance', string='Balance credit amount', help='Balance amount customer can use paid on pos')
    limit_debit = fields.Float('Limit debit', help='Limit credit amount can add to this customer')
    credit_history_ids = fields.One2many('res.partner.credit', 'partner_id', 'Credit histories')

    pos_loyalty_point_import = fields.Float('Point import', default=0, help='Admin system can import point for this customer')
    pos_loyalty_point = fields.Float(compute="_get_point", string='Point', help='Total point of customer can use reward program of pos system')
    pos_loyalty_type = fields.Many2one('pos.loyalty.category', 'Type', help='Customer type of loyalty program')
    discount_id = fields.Many2one('pos.global.discount', 'Pos discount', help='Discount (%) automatic apply for this customer')
    birthday_date = fields.Date('Birthday date')
    group_ids = fields.Many2many('res.partner.group', 'res_partner_group_rel', 'partner_id', 'group_id', string='Groups')

    @api.model
    def create_from_ui(self, partner):
        if partner.get('property_product_pricelist', False):
            partner['property_product_pricelist'] = int(partner['property_product_pricelist'])
        if not partner['property_product_pricelist']:
            del partner['property_product_pricelist']
        for key, value in partner.items():
            if value == "false":
                partner[key] = False
            if value == "true":
                partner[key] = True
        return super(res_partner, self).create_from_ui(partner)

    @api.multi
    def _get_point(self):
        for partner in self:
            partner.pos_loyalty_point = partner.pos_loyalty_point_import
            orders = self.env['pos.order'].search([('partner_id', '=', partner.id)])
            for order in orders:
                partner.pos_loyalty_point += order.plus_point
                partner.pos_loyalty_point -= order.redeem_point

    @api.multi
    def _compute_debit_credit_balance(self):
        for partner in self:
            partner.credit = 0
            partner.debit = 0
            partner.balance = 0
            for credit in partner.credit_history_ids:
                if credit.type == 'plus':
                    partner.credit += credit.amount
                if credit.type == 'redeem':
                    partner.debit += credit.amount
            partner.balance = partner.credit + partner.limit_debit - partner.debit
        return True

    @api.multi
    def _compute_wallet(self):
        wallet_journal = self.env['account.journal'].search([
            ('pos_method_type', '=', 'wallet'), ('company_id', '=', self.env.user.company_id.id)])
        wallet_statements = self.env['account.bank.statement'].search(
            [('journal_id', 'in', [j.id for j in wallet_journal])])
        for partner in self:
            partner.wallet = 0
            if wallet_statements:
                self._cr.execute(
                    """SELECT l.partner_id, SUM(l.amount)
                    FROM account_bank_statement_line l
                    WHERE l.statement_id IN %s AND l.partner_id = %s
                    GROUP BY l.partner_id
                    """,
                    (tuple(wallet_statements.ids), partner.id))
                datas = self._cr.fetchall()
                for item in datas:
                    partner.wallet -= item[1]

    @api.model
    def create(self, vals):
        partner = super(res_partner, self).create(vals)
        self.env['pos.cache.database'].insert_data(self._inherit, partner.id)
        return partner

    @api.multi
    def write(self, vals):
        res = super(res_partner, self).write(vals)
        for partner in self:
            if partner and partner.id != None and partner.active:
                self.env['pos.cache.database'].insert_data(self._inherit, partner.id)
            if partner.active == False:
                self.env['pos.cache.database'].remove_record(self._inherit, partner.id)
        return res

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_record(self._inherit, record.id)
        return super(res_partner, self).unlink()
